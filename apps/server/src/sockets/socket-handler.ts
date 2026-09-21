import { Server as SocketIOServer, Socket } from 'socket.io';
import cookie from 'cookie';
import { SOCKET_EVENTS, PERMISSIONS, TouchPoint, SwipeGesture } from '@android-server/shared';
import { SESSION_COOKIE_NAME, validateSession } from '../auth/auth-service';
import { PtyService } from '../terminal/pty-service';
import { SystemService } from '../system/system-service';
import { CompanionBridge } from '../android/companion-bridge';
import { CONFIG } from '../config';
import { logAudit } from '../audit/audit-service';

export function setupSocketIO(io: SocketIOServer) {
  // 1. Socket Authentication Middleware
  io.use(async (socket: Socket, next) => {
    // Check if this is the Android Companion App
    const companionSecret = socket.handshake.auth?.companionSecret || socket.handshake.headers['x-companion-secret'];
    if (companionSecret === CONFIG.COMPANION_SECRET) {
      (socket as any).isCompanion = true;
      return next();
    }

    // Otherwise, Web Browser Client: parse session cookie or auth token
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
    // If Android Companion
    if ((socket as any).isCompanion) {
      CompanionBridge.handleCompanionConnection(socket);
      return;
    }

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

    // --- Remote Screen Stream ---
    socket.on(SOCKET_EVENTS.REMOTE_SCREEN_START, () => {
      if (!hasPermission(PERMISSIONS.SCREEN_VIEW)) {
        socket.emit('error', 'Permission denied: screen.view required.');
        return;
      }
      socket.join('room:remote-screen');
      CompanionBridge.startScreenCapture();

      logAudit({
        userId: user.id,
        username: user.username,
        action: 'REMOTE_SESSION_START',
        target: 'SCREEN_STREAM',
        status: 'SUCCESS',
        ipAddress: socket.handshake.address,
      });
    });

    socket.on(SOCKET_EVENTS.REMOTE_SCREEN_STOP, () => {
      socket.leave('room:remote-screen');
      logAudit({
        userId: user.id,
        username: user.username,
        action: 'REMOTE_SESSION_END',
        target: 'SCREEN_STREAM',
        status: 'SUCCESS',
        ipAddress: socket.handshake.address,
      });
    });

    // --- Remote Touch & Gestures ---
    socket.on(SOCKET_EVENTS.REMOTE_TOUCH_DOWN, (point: TouchPoint) => {
      if (hasPermission(PERMISSIONS.PHONE_TOUCH)) {
        CompanionBridge.sendTouch('down', point);
      }
    });

    socket.on(SOCKET_EVENTS.REMOTE_TOUCH_MOVE, (point: TouchPoint) => {
      if (hasPermission(PERMISSIONS.PHONE_TOUCH)) {
        CompanionBridge.sendTouch('move', point);
      }
    });

    socket.on(SOCKET_EVENTS.REMOTE_TOUCH_UP, (point: TouchPoint) => {
      if (hasPermission(PERMISSIONS.PHONE_TOUCH)) {
        CompanionBridge.sendTouch('up', point);
      }
    });

    socket.on(SOCKET_EVENTS.REMOTE_GESTURE_SWIPE, (gesture: SwipeGesture) => {
      if (hasPermission(PERMISSIONS.PHONE_TOUCH)) {
        CompanionBridge.sendSwipe(gesture);
      }
    });

    // --- Remote Hardware Navigation Keys ---
    socket.on(SOCKET_EVENTS.REMOTE_NAV_BACK, () => {
      if (hasPermission(PERMISSIONS.PHONE_CONTROL)) {
        CompanionBridge.sendNavAction('back');
      }
    });

    socket.on(SOCKET_EVENTS.REMOTE_NAV_HOME, () => {
      if (hasPermission(PERMISSIONS.PHONE_CONTROL)) {
        CompanionBridge.sendNavAction('home');
      }
    });

    socket.on(SOCKET_EVENTS.REMOTE_NAV_RECENTS, () => {
      if (hasPermission(PERMISSIONS.PHONE_CONTROL)) {
        CompanionBridge.sendNavAction('recents');
      }
    });

    socket.on(SOCKET_EVENTS.REMOTE_NAV_LOCK, () => {
      if (hasPermission(PERMISSIONS.PHONE_CONTROL)) {
        CompanionBridge.sendNavAction('lock');
      }
    });

    // --- Remote Volume Controls ---
    socket.on(SOCKET_EVENTS.REMOTE_VOLUME_UP, () => {
      if (hasPermission(PERMISSIONS.PHONE_CONTROL)) {
        CompanionBridge.sendVolumeAction('up');
      }
    });

    socket.on(SOCKET_EVENTS.REMOTE_VOLUME_DOWN, () => {
      if (hasPermission(PERMISSIONS.PHONE_CONTROL)) {
        CompanionBridge.sendVolumeAction('down');
      }
    });

    socket.on(SOCKET_EVENTS.REMOTE_VOLUME_MUTE, () => {
      if (hasPermission(PERMISSIONS.PHONE_CONTROL)) {
        CompanionBridge.sendVolumeAction('mute');
      }
    });

    // --- Remote Clipboard ---
    socket.on(SOCKET_EVENTS.REMOTE_CLIPBOARD_READ, () => {
      if (hasPermission(PERMISSIONS.PHONE_CLIPBOARD)) {
        CompanionBridge.requestClipboard();
      }
    });

    socket.on(SOCKET_EVENTS.REMOTE_CLIPBOARD_WRITE, (payload: { text: string }) => {
      if (hasPermission(PERMISSIONS.PHONE_CLIPBOARD) && payload?.text) {
        CompanionBridge.writeClipboard(payload.text);
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
