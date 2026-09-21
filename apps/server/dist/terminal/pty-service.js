"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PtyService = void 0;
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const shared_1 = require("@android-server/shared");
const audit_service_1 = require("../audit/audit-service");
const activeSessions = new Map();
function getShellPath() {
    // Termux default bash
    const termuxBash = '/data/data/com.termux/files/usr/bin/bash';
    if (fs_1.default.existsSync(termuxBash)) {
        return termuxBash;
    }
    // Termux login shell
    const termuxLogin = '/data/data/com.termux/files/usr/bin/login';
    if (fs_1.default.existsSync(termuxLogin)) {
        return termuxLogin;
    }
    if (process.env.SHELL && fs_1.default.existsSync(process.env.SHELL)) {
        return process.env.SHELL;
    }
    if (os_1.default.platform() === 'win32') {
        return process.env.COMSPEC || 'powershell.exe';
    }
    return '/bin/sh';
}
class PtyService {
    static createSession(socket, user) {
        const sessionId = `term_${socket.id}`;
        const shell = getShellPath();
        let ptyProcess = null;
        let isPty = false;
        // Try node-pty if installed and functional
        try {
            // Dynamic require to avoid crashing if native node-pty build is absent
            const pty = require('node-pty');
            ptyProcess = pty.spawn(shell, [], {
                name: 'xterm-256color',
                cols: 80,
                rows: 24,
                cwd: process.env.HOME || process.cwd(),
                env: {
                    ...process.env,
                    TERM: 'xterm-256color',
                    COLORTERM: 'truecolor',
                },
            });
            ptyProcess.onData((data) => {
                socket.emit(shared_1.SOCKET_EVENTS.TERMINAL_DATA, data);
            });
            ptyProcess.onExit(({ exitCode, signal }) => {
                socket.emit(shared_1.SOCKET_EVENTS.TERMINAL_EXIT, { exitCode, signal });
                activeSessions.delete(sessionId);
            });
            isPty = true;
        }
        catch {
            // Robust child_process interactive fallback
            const env = {
                ...process.env,
                PATH: `/data/data/com.termux/files/usr/bin:/data/data/com.termux/files/usr/bin/applets:${process.env.PATH || '/system/bin'}`,
                TERM: 'xterm-256color',
                COLORTERM: 'truecolor',
                PS1: '\\[\\033[01;32m\\]termux@phone\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]$ ',
            };
            const shellArgs = shell.includes('bash') || shell.includes('sh') ? ['-i'] : [];
            const child = (0, child_process_1.spawn)(shell, shellArgs, {
                cwd: process.env.HOME || process.cwd(),
                env,
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: false,
            });
            // Initial interactive prompt banner
            socket.emit(shared_1.SOCKET_EVENTS.TERMINAL_DATA, '\r\n\x1b[1;36m=== PHONE NAS SHELL (TERMUX) ===\x1b[0m\r\n\x1b[90mReady. Try commands: ls, df -h, free -m, top, ip a, termux-battery-status\x1b[0m\r\n\r\n');
            // Normalize newlines to \r\n so cursor always returns to column 0 (prevents staircase effect)
            const formatOutput = (text) => {
                return text.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
            };
            child.stdout?.on('data', (chunk) => {
                socket.emit(shared_1.SOCKET_EVENTS.TERMINAL_DATA, formatOutput(chunk.toString('utf-8')));
            });
            child.stderr?.on('data', (chunk) => {
                socket.emit(shared_1.SOCKET_EVENTS.TERMINAL_DATA, formatOutput(chunk.toString('utf-8')));
            });
            child.on('close', (code) => {
                socket.emit(shared_1.SOCKET_EVENTS.TERMINAL_EXIT, { exitCode: code });
                activeSessions.delete(sessionId);
            });
            ptyProcess = child;
            isPty = false;
            // Send a newline to trigger the initial bash prompt
            setTimeout(() => {
                if (child.stdin && !child.stdin.destroyed) {
                    child.stdin.write('\n');
                }
            }, 200);
        }
        const session = {
            id: sessionId,
            socketId: socket.id,
            userId: user.id,
            username: user.username,
            process: ptyProcess,
            isPty,
            createdAt: new Date(),
        };
        activeSessions.set(sessionId, session);
        (0, audit_service_1.logAudit)({
            userId: user.id,
            username: user.username,
            action: 'SHELL_OPEN',
            target: shell,
            status: 'SUCCESS',
            ipAddress: socket.handshake.address,
            details: { ptyMode: isPty ? 'native-pty' : 'pipe-interactive' },
        });
        return session;
    }
    static writeInput(socketId, data) {
        const session = activeSessions.get(`term_${socketId}`);
        if (!session)
            return;
        if (session.isPty) {
            session.process.write(data);
        }
        else if (session.process.stdin && !session.process.stdin.destroyed) {
            // In pipe mode, convert CR (\r) from xterm into LF (\n) for Linux bash
            if (data === '\r' || data === '\r\n') {
                session.process.stdin.write('\n');
            }
            else if (data === '\x03') {
                // Ctrl+C
                try {
                    session.process.kill('SIGINT');
                }
                catch { }
            }
            else {
                session.process.stdin.write(data);
            }
        }
    }
    static resize(socketId, cols, rows) {
        const session = activeSessions.get(`term_${socketId}`);
        if (!session)
            return;
        if (session.isPty && typeof session.process.resize === 'function') {
            try {
                session.process.resize(cols, rows);
            }
            catch (err) {
                console.warn('[PTY] Resize error:', err);
            }
        }
    }
    static destroySession(socketId) {
        const sessionId = `term_${socketId}`;
        const session = activeSessions.get(sessionId);
        if (!session)
            return;
        try {
            if (session.isPty) {
                session.process.kill();
            }
            else {
                session.process.kill('SIGTERM');
            }
        }
        catch { }
        activeSessions.delete(sessionId);
        (0, audit_service_1.logAudit)({
            userId: session.userId,
            username: session.username,
            action: 'SHELL_CLOSE',
            target: session.id,
            status: 'SUCCESS',
            ipAddress: '',
        });
    }
}
exports.PtyService = PtyService;
