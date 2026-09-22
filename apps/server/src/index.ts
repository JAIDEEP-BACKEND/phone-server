// SIGHUP, SIGTERM & Crash Guard for persistent Termux daemon operation
process.on('SIGHUP', () => {
  console.log('[DAEMON] Intercepted SIGHUP (Termux detached or backgrounded). Server continuing uninterrupted.');
});
process.on('SIGTERM', () => {
  console.log('[DAEMON] Intercepted SIGTERM signal. Keeping listener alive.');
});
process.on('uncaughtException', (err) => {
  console.error('[CRASH_GUARD] Intercepted Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[CRASH_GUARD] Intercepted Unhandled Rejection:', reason);
});

import http from 'http';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Server as SocketIOServer } from 'socket.io';
import { CONFIG } from './config';
import { initDatabase } from './database/db';
import { authMiddleware } from './security/rbac-middleware';
import { setAuditSocketIO } from './audit/audit-service';
import path from 'path';
import fs from 'fs';
import { DeviceInfoService } from './system/device-info';
import { setupSocketIO } from './sockets/socket-handler';

// Routes
import { authRouter } from './routes/auth.routes';
import { filesRouter } from './routes/files.routes';
import { systemRouter } from './routes/system.routes';
import { phoneRouter } from './routes/phone.routes';
import { usersRouter } from './routes/users.routes';
import { logsRouter } from './routes/logs.routes';
import { settingsRouter } from './routes/settings.routes';

async function bootstrap() {
  // 1. Initialize SQLite Database
  await initDatabase();

  const app = express();
  const server = http.createServer(app);

  // 2. Setup Socket.IO
  const io = new SocketIOServer(server, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  setAuditSocketIO(io);
  setupSocketIO(io);
  const { setActiveSocketIO, broadcastFileEvent } = require('./sockets/socket-handler');
  setActiveSocketIO(io);

  // Storage filesystem live watcher for real-time instant syncing
  try {
    if (fs.existsSync(CONFIG.STORAGE_ROOT)) {
      let watchDebounce: any = null;
      fs.watch(CONFIG.STORAGE_ROOT, { recursive: true }, (event, filename) => {
        if (!filename || filename.startsWith('.') || filename.includes('.nas_temp_uploads')) return;
        if (watchDebounce) clearTimeout(watchDebounce);
        watchDebounce = setTimeout(() => {
          broadcastFileEvent({ path: '/' + filename.replace(/\\/g, '/'), action: event });
        }, 300);
      });
      console.log(`[WATCHER] Active real-time storage sync enabled on ${CONFIG.STORAGE_ROOT}`);
    }
  } catch (err: any) {
    console.log('[WATCHER] Native recursive watch not available, relying on event triggers.');
  }

  // 3. Security & Middleware
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );

  app.use(cookieParser(CONFIG.COOKIE_SECRET));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Global Auth Session Middleware
  app.use(authMiddleware);

  // 4. Mount API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/files', filesRouter);
  app.use('/api/system', systemRouter);
  app.use('/api/phone', phoneRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/logs', logsRouter);
  app.use('/api/settings', settingsRouter);

  // 5. Serve static Web Console frontend
  const webOutDir = path.resolve(__dirname, '../../web/out');
  if (fs.existsSync(webOutDir)) {
    app.use(express.static(webOutDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      const cleanPath = req.path.replace(/\/$/, '');
      const candidateHtml = path.join(webOutDir, cleanPath, 'index.html');
      if (cleanPath && fs.existsSync(candidateHtml)) {
        return res.sendFile(candidateHtml);
      }
      res.sendFile(path.join(webOutDir, 'index.html'));
    });
  }

  // 6. Clean Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(`[SERVER ERROR] ${req.method} ${req.url}:`, err);
    res.status(err.status || 500).json({
      error: err.message || 'An unexpected internal server error occurred.',
      code: err.code || 'INTERNAL_ERROR',
    });
  });

  // 7. Start Listener
  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[FATAL] Port ${CONFIG.PORT} is already in use (EADDRINUSE).`);
      console.error(`[FIX] In Termux, run: killall node  (or: fuser -k ${CONFIG.PORT}/tcp)`);
      process.exit(1);
    }
    console.error('[FATAL] Server listener error:', err);
    process.exit(1);
  });

  server.listen(CONFIG.PORT, CONFIG.HOST, () => {
    const deviceInfo = DeviceInfoService.getDeviceInfo();
    console.log('====================================================');
    console.log('  PHONE ANDROID NAS & PERSONAL SERVER - ACTIVE');
    console.log('====================================================');
    console.log(`  Local Address:     http://localhost:${CONFIG.PORT}`);
    console.log(`  LAN IP Address:    http://${deviceInfo.ipAddress}:${CONFIG.PORT}`);
    console.log(`  Phone Hotspot AP:  http://192.168.43.1:${CONFIG.PORT} (Connect to phone's Wi-Fi hotspot)`);
    console.log(`  Storage Root:      ${CONFIG.STORAGE_ROOT}`);
    console.log(`  Database File:     ${CONFIG.DATABASE_PATH}`);
    console.log(`  Architecture:      ${deviceInfo.architecture}`);
    if (CONFIG.HOST === '0.0.0.0') {
      console.log('  [NOTICE] Listening on 0.0.0.0 (Accessible to devices on hotspot or local network)');
    }
    console.log('====================================================');
  });
}

bootstrap().catch((err) => {
  console.error('[FATAL] Failed to start server:', err);
  process.exit(1);
});

