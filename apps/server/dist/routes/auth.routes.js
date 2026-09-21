"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_service_1 = require("../auth/auth-service");
const config_1 = require("../config");
exports.authRouter = (0, express_1.Router)();
// GET /api/auth/status
exports.authRouter.get('/status', async (req, res) => {
    try {
        const adminExists = await (0, auth_service_1.hasAnyAdmin)();
        res.json({
            hasAdmin: adminExists,
            authenticated: !!req.user,
            user: req.user || null,
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// POST /api/auth/first-admin
const firstAdminSchema = zod_1.z.object({
    username: zod_1.z.string().min(3).max(32),
    password: zod_1.z.string().min(8).max(128),
});
exports.authRouter.post('/first-admin', async (req, res) => {
    try {
        const parse = firstAdminSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ error: 'Invalid username or password length.' });
        }
        const { username, password } = parse.data;
        const user = await (0, auth_service_1.createFirstAdmin)(username, password, req.ip || '');
        res.json({
            message: 'First administrator configured successfully.',
            user,
        });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// POST /api/auth/login
const loginSchema = zod_1.z.object({
    username: zod_1.z.string(),
    password: zod_1.z.string(),
});
exports.authRouter.post('/login', async (req, res) => {
    try {
        const parse = loginSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ error: 'Username and password are required.' });
        }
        const { username, password } = parse.data;
        const { sessionToken, user } = await (0, auth_service_1.login)(username, password, req.ip || '', req.headers['user-agent']);
        // Set secure HTTP-only cookie
        res.cookie(auth_service_1.SESSION_COOKIE_NAME, sessionToken, {
            httpOnly: true,
            secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
            sameSite: 'lax',
            maxAge: config_1.CONFIG.SESSION_TTL_HOURS * 3600 * 1000,
            path: '/',
        });
        res.json({
            message: 'Login successful.',
            user,
            token: sessionToken,
        });
    }
    catch (err) {
        res.status(401).json({ error: err.message });
    }
});
// POST /api/auth/logout
exports.authRouter.post('/logout', async (req, res) => {
    if (req.sessionToken) {
        await (0, auth_service_1.destroySession)(req.sessionToken, req.user?.id, req.user?.username, req.ip);
    }
    res.clearCookie(auth_service_1.SESSION_COOKIE_NAME, { path: '/' });
    res.json({ message: 'Logged out successfully.' });
});
// GET /api/auth/me
exports.authRouter.get('/me', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json({ user: req.user });
});
