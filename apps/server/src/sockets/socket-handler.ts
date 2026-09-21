import { Server as SocketIOServer, Socket } from 'socket.io';
import cookie from 'cookie';
import { SOCKET_EVENTS, PERMISSIONS } from '@android-server/shared';
import { SESSION_COOKIE_NAME, validateSession } from '../auth/auth-service';
import { PtyService } from '../terminal/pty-service';
import { SystemService } from '../system/system-service';

export function setupSocketIO(io: SocketIOServer) {
  // 1. Socket Authentication Middleware
  io.use(async (socket: Socket, next) => {
    let sessionToken: string | undefined = socket.handshake.auth?.token;

    if (!sessionToken && socket.handshake.headers.cookie) {
      const parsedCookies = cookie.parse(socket.handshake.headers.cookie);
      sessionToken = parsedCookies[SESSION_COOKIE_NAME];
    }

    if (!sessionToken) {
      return next(new Error('Authentication required for WebSocket connection.'));
    }

    try {
      const user = await validateSession(sessionToken);
      if (!user) {
        return next(new Error('Invalid or expired session.'));
      }
      (socket as any).user = user;
      next();
    } catch (err: any) {
      next(new Error(`Authentication failed: ${err.message}`));
    }
  });

  // 2. Connection Handler
  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    if (!user) {
      socket.disconnect(true);
      return;
    }

    const hasPermission = (p: string) => user.role === 'ADMIN' || user.permissions.includes(p);

    // Join activity logs room if authorized
    if (hasPermission(PERMISSIONS.LOGS_VIEW)) {
      socket.join('room:logs');
    }

    // --- System Telemetry Subscription ---
    socket.on(SOCKET_EVENTS.SYSTEM_STATS_SUBSCRIBE, () => {
      if (hasPermission(PERMISSIONS.SYSTEM_VIEW)) {
        socket.join('room:system');
      }
    });

    socket.on(SOCKET_EVENTS.SYSTEM_STATS_UNSUBSCRIBE, () => {
      socket.leave('room:system');
    });

    // --- Web Terminal (PTY) ---
    socket.on('terminal:init', () => {
      if (!hasPermission(PERMISSIONS.SHELL_ACCESS)) {
        socket.emit('terminal:error', 'Permission denied: shell.access required.');
        return;
      }
      PtyService.createSession(socket, user);
    });

    socket.on(SOCKET_EVENTS.TERMINAL_INPUT, (data: string) => {
      if (hasPermission(PERMISSIONS.SHELL_ACCESS)) {
        PtyService.writeInput(socket.id, data);
      }
    });

    socket.on(SOCKET_EVENTS.TERMINAL_RESIZE, (payload: { cols: number; rows: number }) => {
      if (hasPermission(PERMISSIONS.SHELL_ACCESS) && payload?.cols && payload?.rows) {
        PtyService.resize(socket.id, payload.cols, payload.rows);
      }
    });

    // Disconnect cleanup
    socket.on('disconnect', () => {
      PtyService.destroySession(socket.id);
    });
  });

  // 3. Background System Telemetry Pulse (1 second interval)
  setInterval(async () => {
    try {
      const clientsInSystemRoom = await io.in('room:system').fetchSockets();
      if (clientsInSystemRoom.length > 0) {
        const vitals = await SystemService.collectVitals();
        io.to('room:system').emit(SOCKET_EVENTS.SYSTEM_STATS, vitals);
      }
    } catch (err) {
      console.error('[SOCKET] Telemetry broadcast error:', err);
    }
  }, 1000);
}

let activeSocketIO: SocketIOServer | null = null;

export function setActiveSocketIO(io: SocketIOServer) {
  activeSocketIO = io;
}

export function broadcastFileEvent(event: { path: string; action: string }) {
  if (activeSocketIO) {
    activeSocketIO.emit('files:changed', {
      ...event,
      timestamp: Date.now(),
    });
  }
}

