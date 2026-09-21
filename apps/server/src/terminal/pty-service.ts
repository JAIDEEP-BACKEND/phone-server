import { spawn, ChildProcess } from 'child_process';
import { Socket } from 'socket.io';
import fs from 'fs';
import os from 'os';
import { SOCKET_EVENTS } from '@android-server/shared';
import { logAudit } from '../audit/audit-service';

interface TerminalSession {
  id: string;
  socketId: string;
  userId: string;
  username: string;
  process: any; // pty or ChildProcess
  isPty: boolean;
  createdAt: Date;
}

const activeSessions = new Map<string, TerminalSession>();

function getShellPath(): string {
  // Termux default bash
  const termuxBash = '/data/data/com.termux/files/usr/bin/bash';
  if (fs.existsSync(termuxBash)) {
    return termuxBash;
  }

  // Termux login shell
  const termuxLogin = '/data/data/com.termux/files/usr/bin/login';
  if (fs.existsSync(termuxLogin)) {
    return termuxLogin;
  }

  if (process.env.SHELL && fs.existsSync(process.env.SHELL)) {
    return process.env.SHELL;
  }

  if (os.platform() === 'win32') {
    return process.env.COMSPEC || 'powershell.exe';
  }

  return '/bin/sh';
}

export class PtyService {
  static createSession(socket: Socket, user: { id: string; username: string }): TerminalSession {
    const sessionId = `term_${socket.id}`;
    const shell = getShellPath();

    let ptyProcess: any = null;
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

      ptyProcess.onData((data: string) => {
        socket.emit(SOCKET_EVENTS.TERMINAL_DATA, data);
      });

      ptyProcess.onExit(({ exitCode, signal }: any) => {
        socket.emit(SOCKET_EVENTS.TERMINAL_EXIT, { exitCode, signal });
        activeSessions.delete(sessionId);
      });

      isPty = true;
    } catch {
      // Robust child_process fallback
      const child = spawn(shell, [], {
        cwd: process.env.HOME || process.cwd(),
        env: {
          ...process.env,
          TERM: 'xterm-256color',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
      });

      child.stdout?.on('data', (chunk: Buffer) => {
        socket.emit(SOCKET_EVENTS.TERMINAL_DATA, chunk.toString('utf-8'));
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        socket.emit(SOCKET_EVENTS.TERMINAL_DATA, chunk.toString('utf-8'));
      });

      child.on('close', (code: number) => {
        socket.emit(SOCKET_EVENTS.TERMINAL_EXIT, { exitCode: code });
        activeSessions.delete(sessionId);
      });

      ptyProcess = child;
      isPty = false;
    }

    const session: TerminalSession = {
      id: sessionId,
      socketId: socket.id,
      userId: user.id,
      username: user.username,
      process: ptyProcess,
      isPty,
      createdAt: new Date(),
    };

    activeSessions.set(sessionId, session);

    logAudit({
      userId: user.id,
      username: user.username,
      action: 'SHELL_OPEN',
      target: shell,
      status: 'SUCCESS',
      ipAddress: socket.handshake.address,
      details: { ptyMode: isPty ? 'native-pty' : 'pipe-fallback' },
    });

    return session;
  }

  static writeInput(socketId: string, data: string) {
    const session = activeSessions.get(`term_${socketId}`);
    if (!session) return;

    if (session.isPty) {
      session.process.write(data);
    } else if (session.process.stdin && !session.process.stdin.destroyed) {
      session.process.stdin.write(data);
    }
  }

  static resize(socketId: string, cols: number, rows: number) {
    const session = activeSessions.get(`term_${socketId}`);
    if (!session) return;

    if (session.isPty && typeof session.process.resize === 'function') {
      try {
        session.process.resize(cols, rows);
      } catch (err) {
        console.warn('[PTY] Resize error:', err);
      }
    }
  }

  static destroySession(socketId: string) {
    const sessionId = `term_${socketId}`;
    const session = activeSessions.get(sessionId);
    if (!session) return;

    try {
      if (session.isPty) {
        session.process.kill();
      } else {
        session.process.kill('SIGTERM');
      }
    } catch {}

    activeSessions.delete(sessionId);

    logAudit({
      userId: session.userId,
      username: session.username,
      action: 'SHELL_CLOSE',
      target: session.id,
      status: 'SUCCESS',
      ipAddress: '',
    });
  }
}
