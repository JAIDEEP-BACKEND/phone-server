"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocketIO = setupSocketIO;
exports.setActiveSocketIO = setActiveSocketIO;
exports.broadcastFileEvent = broadcastFileEvent;
const cookie_1 = __importDefault(require("cookie"));
const shared_1 = require("@android-server/shared");
const auth_service_1 = require("../auth/auth-service");
const pty_service_1 = require("../terminal/pty-service");
const system_service_1 = require("../system/system-service");
function setupSocketIO(io) {
    // 1. Socket Authentication Middleware
    io.use(async (socket, next) => {
        let sessionToken = socket.handshake.auth?.token;
        if (!sessionToken && socket.handshake.headers.cookie) {
            const parsedCookies = cookie_1.default.parse(socket.handshake.headers.cookie);
            sessionToken = parsedCookies[auth_service_1.SESSION_COOKIE_NAME];
        }
        if (!sessionToken) {
            return next(new Error('Authentication required for WebSocket connection.'));
        }
        try {
            const user = await (0, auth_service_1.validateSession)(sessionToken);
            if (!user) {
                return next(new Error('Invalid or expired session.'));
            }
            socket.user = user;
            next();
        }
        catch (err) {
            next(new Error(`Authentication failed: ${err.message}`));
        }
    });
    // 2. Connection Handler
    io.on('connection', (socket) => {
        const user = socket.user;
        if (!user) {
            socket.disconnect(true);
            return;
        }
        const hasPermission = (p) => user.role === 'ADMIN' || user.permissions.includes(p);
        // Join activity logs room if authorized
        if (hasPermission(shared_1.PERMISSIONS.LOGS_VIEW)) {
            socket.join('room:logs');
        }
        // --- System Telemetry Subscription ---
        socket.on(shared_1.SOCKET_EVENTS.SYSTEM_STATS_SUBSCRIBE, () => {
            if (hasPermission(shared_1.PERMISSIONS.SYSTEM_VIEW)) {
                socket.join('room:system');
            }
        });
        socket.on(shared_1.SOCKET_EVENTS.SYSTEM_STATS_UNSUBSCRIBE, () => {
            socket.leave('room:system');
        });
        // --- Web Terminal (PTY) ---
        socket.on('terminal:init', () => {
            if (!hasPermission(shared_1.PERMISSIONS.SHELL_ACCESS)) {
                socket.emit('terminal:error', 'Permission denied: shell.access required.');
                return;
            }
            pty_service_1.PtyService.createSession(socket, user);
        });
        socket.on(shared_1.SOCKET_EVENTS.TERMINAL_INPUT, (data) => {
            if (hasPermission(shared_1.PERMISSIONS.SHELL_ACCESS)) {
                pty_service_1.PtyService.writeInput(socket.id, data);
            }
        });
        socket.on(shared_1.SOCKET_EVENTS.TERMINAL_RESIZE, (payload) => {
            if (hasPermission(shared_1.PERMISSIONS.SHELL_ACCESS) && payload?.cols && payload?.rows) {
                pty_service_1.PtyService.resize(socket.id, payload.cols, payload.rows);
            }
        });
        // Disconnect cleanup
        socket.on('disconnect', () => {
            pty_service_1.PtyService.destroySession(socket.id);
        });
    });
    // 3. Low-Power System Telemetry Pulse (Only fires when dashboard is open)
    setInterval(async () => {
        try {
            const clientsInSystemRoom = await io.in('room:system').fetchSockets();
            if (clientsInSystemRoom.length > 0) {
                const vitals = await system_service_1.SystemService.collectVitals();
                io.to('room:system').emit(shared_1.SOCKET_EVENTS.SYSTEM_STATS, vitals);
            }
        }
        catch (err) {
            console.error('[SOCKET] Telemetry broadcast error:', err);
        }
    }, 2500);
}
let activeSocketIO = null;
function setActiveSocketIO(io) {
    activeSocketIO = io;
}
function broadcastFileEvent(event) {
    if (activeSocketIO) {
        activeSocketIO.emit('files:changed', {
            ...event,
            timestamp: Date.now(),
        });
    }
}
