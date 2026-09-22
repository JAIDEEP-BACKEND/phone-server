"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
const http_1 = __importDefault(require("http"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const socket_io_1 = require("socket.io");
const config_1 = require("./config");
const db_1 = require("./database/db");
const rbac_middleware_1 = require("./security/rbac-middleware");
const audit_service_1 = require("./audit/audit-service");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const device_info_1 = require("./system/device-info");
const socket_handler_1 = require("./sockets/socket-handler");
// Routes
const auth_routes_1 = require("./routes/auth.routes");
const files_routes_1 = require("./routes/files.routes");
const system_routes_1 = require("./routes/system.routes");
const phone_routes_1 = require("./routes/phone.routes");
const users_routes_1 = require("./routes/users.routes");
const logs_routes_1 = require("./routes/logs.routes");
const settings_routes_1 = require("./routes/settings.routes");
async function bootstrap() {
    // 1. Initialize SQLite Database
    await (0, db_1.initDatabase)();
    const app = (0, express_1.default)();
    const server = http_1.default.createServer(app);
    // 2. Setup Socket.IO
    const io = new socket_io_1.Server(server, {
        cors: {
            origin: true,
            credentials: true,
        },
    });
    (0, audit_service_1.setAuditSocketIO)(io);
    (0, socket_handler_1.setupSocketIO)(io);
    const { setActiveSocketIO, broadcastFileEvent } = require('./sockets/socket-handler');
    setActiveSocketIO(io);
    // Storage filesystem live watcher for real-time instant syncing
    try {
        if (fs_1.default.existsSync(config_1.CONFIG.STORAGE_ROOT)) {
            let watchDebounce = null;
            fs_1.default.watch(config_1.CONFIG.STORAGE_ROOT, { recursive: true }, (event, filename) => {
                if (!filename || filename.startsWith('.') || filename.includes('.nas_temp_uploads'))
                    return;
                if (watchDebounce)
                    clearTimeout(watchDebounce);
                watchDebounce = setTimeout(() => {
                    broadcastFileEvent({ path: '/' + filename.replace(/\\/g, '/'), action: event });
                }, 300);
            });
            console.log(`[WATCHER] Active real-time storage sync enabled on ${config_1.CONFIG.STORAGE_ROOT}`);
        }
    }
    catch (err) {
        console.log('[WATCHER] Native recursive watch not available, relying on event triggers.');
    }
    // 3. Security & Middleware
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
    }));
    app.use((0, cors_1.default)({
        origin: true,
        credentials: true,
    }));
    app.use((0, cookie_parser_1.default)(config_1.CONFIG.COOKIE_SECRET));
    app.use(express_1.default.json({ limit: '10mb' }));
    app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
    // Global Auth Session Middleware
    app.use(rbac_middleware_1.authMiddleware);
    // 4. Mount API Routes
    app.use('/api/auth', auth_routes_1.authRouter);
    app.use('/api/files', files_routes_1.filesRouter);
    app.use('/api/system', system_routes_1.systemRouter);
    app.use('/api/phone', phone_routes_1.phoneRouter);
    app.use('/api/users', users_routes_1.usersRouter);
    app.use('/api/logs', logs_routes_1.logsRouter);
    app.use('/api/settings', settings_routes_1.settingsRouter);
    // Captive Portal & Hotspot Helper Probes (Zero-Internet Hotspot Compatibility)
    app.get(['/generate_204', '/gen_204'], (req, res) => {
        res.status(204).end();
    });
    app.get(['/hotspot-detect.html', '/canonical.html', '/success.txt', '/library/test/success.html'], (req, res) => {
        res.redirect('/');
    });
    app.get(['/ncsi.txt', '/connecttest.txt'], (req, res) => {
        res.type('text/plain').send('Microsoft NCSI');
    });
    // 5. Serve static Web Console frontend
    const webOutDir = path_1.default.resolve(__dirname, '../../web/out');
    if (fs_1.default.existsSync(webOutDir)) {
        app.use(express_1.default.static(webOutDir));
        app.get('*', (req, res, next) => {
            if (req.path.startsWith('/api'))
                return next();
            const cleanPath = req.path.replace(/\/$/, '');
            const candidateHtml = path_1.default.join(webOutDir, cleanPath, 'index.html');
            if (cleanPath && fs_1.default.existsSync(candidateHtml)) {
                return res.sendFile(candidateHtml);
            }
            res.sendFile(path_1.default.join(webOutDir, 'index.html'));
        });
    }
    // 6. Clean Error Handler
    app.use((err, req, res, next) => {
        console.error(`[SERVER ERROR] ${req.method} ${req.url}:`, err);
        res.status(err.status || 500).json({
            error: err.message || 'An unexpected internal server error occurred.',
            code: err.code || 'INTERNAL_ERROR',
        });
    });
    // 7. Start Listener
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`\n[FATAL] Port ${config_1.CONFIG.PORT} is already in use (EADDRINUSE).`);
            console.error(`[FIX] In Termux, run: killall node  (or: fuser -k ${config_1.CONFIG.PORT}/tcp)`);
            process.exit(1);
        }
        console.error('[FATAL] Server listener error:', err);
        process.exit(1);
    });
    server.listen(config_1.CONFIG.PORT, config_1.CONFIG.HOST, () => {
        const deviceInfo = device_info_1.DeviceInfoService.getDeviceInfo();
        console.log('====================================================');
        console.log('  🔥 PHONE HOTSPOT NAS & OFFLINE PERSONAL SERVER');
        console.log('====================================================');
        console.log(`  📱 DIRECT HOTSPOT ACCESS:`);
        console.log(`     👉 http://192.168.43.1:${config_1.CONFIG.PORT}`);
        console.log(`  💻 PHONE LOCALHOST:`);
        console.log(`     👉 http://localhost:${config_1.CONFIG.PORT}`);
        if (deviceInfo.ipAddress && deviceInfo.ipAddress !== '127.0.0.1' && deviceInfo.ipAddress !== '192.168.43.1') {
            console.log(`  🌐 OTHER NETWORK / LAN IP:`);
            console.log(`     👉 http://${deviceInfo.ipAddress}:${config_1.CONFIG.PORT}`);
        }
        console.log('----------------------------------------------------');
        console.log('  ⚡ Mode: 100% Offline Direct Wi-Fi (No Internet Needed)');
        console.log(`  📂 Storage Root: ${config_1.CONFIG.STORAGE_ROOT}`);
        console.log('====================================================');
    });
}
bootstrap().catch((err) => {
    console.error('[FATAL] Failed to start server:', err);
    process.exit(1);
});
