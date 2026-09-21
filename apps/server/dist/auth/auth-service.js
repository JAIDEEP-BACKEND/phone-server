"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SESSION_COOKIE_NAME = void 0;
exports.hasAnyAdmin = hasAnyAdmin;
exports.getUserPermissions = getUserPermissions;
exports.createFirstAdmin = createFirstAdmin;
exports.login = login;
exports.validateSession = validateSession;
exports.destroySession = destroySession;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("../database/db");
const config_1 = require("../config");
const shared_1 = require("@android-server/shared");
const rate_limiter_1 = require("../security/rate-limiter");
const audit_service_1 = require("../audit/audit-service");
exports.SESSION_COOKIE_NAME = 'nas_session_id';
async function hasAnyAdmin() {
    const row = await db_1.query.get(`SELECT COUNT(*) as count FROM users WHERE role = 'ADMIN' AND is_active = 1`);
    return (row?.count || 0) > 0;
}
async function getUserPermissions(userId) {
    const rows = await db_1.query.all(`SELECT permission_name FROM user_permissions WHERE user_id = ?`, [userId]);
    return rows.map((r) => r.permission_name);
}
async function createFirstAdmin(username, passwordPlain, ipAddress) {
    const adminExists = await hasAnyAdmin();
    if (adminExists) {
        throw new Error('An administrator account is already configured.');
    }
    if (!username || username.trim().length < 3) {
        throw new Error('Username must be at least 3 characters.');
    }
    if (!passwordPlain || passwordPlain.length < 8) {
        throw new Error('Password must be at least 8 characters.');
    }
    const salt = await bcryptjs_1.default.genSalt(12);
    const passwordHash = await bcryptjs_1.default.hash(passwordPlain, salt);
    const userId = `usr_${crypto_1.default.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();
    await db_1.query.run(`INSERT INTO users (id, username, password_hash, role, is_active, created_at)
     VALUES (?, ?, ?, 'ADMIN', 1, ?)`, [userId, username.trim(), passwordHash, now]);
    // Assign all admin permissions
    const adminPermissions = shared_1.ROLE_DEFAULT_PERMISSIONS.ADMIN;
    for (const perm of adminPermissions) {
        await db_1.query.run(`INSERT INTO user_permissions (user_id, permission_name) VALUES (?, ?)`, [userId, perm]);
    }
    await (0, audit_service_1.logAudit)({
        userId,
        username: username.trim(),
        action: 'USER_CREATE',
        target: 'FIRST_ADMIN',
        status: 'SUCCESS',
        ipAddress,
        details: 'Initial administrator registered.',
    });
    return {
        id: userId,
        username: username.trim(),
        role: 'ADMIN',
        permissions: adminPermissions,
        isActive: true,
        createdAt: now,
        lastLoginAt: null,
    };
}
async function login(username, passwordPlain, ipAddress, userAgent = '') {
    // Check rate limit
    const rateLimit = await (0, rate_limiter_1.checkRateLimit)(ipAddress);
    if (rateLimit.isLocked) {
        await (0, audit_service_1.logAudit)({
            username: username || 'unknown',
            action: 'LOGIN_LOCKOUT',
            target: ipAddress,
            status: 'DENIED',
            ipAddress,
            details: `Account temporarily locked. Retry in ${rateLimit.lockRemainingSeconds} seconds.`,
        });
        throw new Error(`Too many failed login attempts. Try again in ${rateLimit.lockRemainingSeconds}s.`);
    }
    const user = await db_1.query.get(`SELECT * FROM users WHERE username = ?`, [username]);
    if (!user || user.is_active !== 1) {
        await (0, rate_limiter_1.recordFailedAttempt)(ipAddress);
        await (0, audit_service_1.logAudit)({
            username: username || 'unknown',
            action: 'AUTH_FAILURE',
            target: 'CREDENTIALS',
            status: 'FAILURE',
            ipAddress,
            details: 'Invalid username or inactive account',
        });
        throw new Error('Invalid username or password.');
    }
    const isValidPassword = await bcryptjs_1.default.compare(passwordPlain, user.password_hash);
    if (!isValidPassword) {
        const status = await (0, rate_limiter_1.recordFailedAttempt)(ipAddress);
        await (0, audit_service_1.logAudit)({
            userId: user.id,
            username: user.username,
            action: 'AUTH_FAILURE',
            target: 'CREDENTIALS',
            status: 'FAILURE',
            ipAddress,
            details: `Invalid password. Remaining attempts: ${status.remainingAttempts}`,
        });
        throw new Error('Invalid username or password.');
    }
    // Clear rate limits on successful authentication
    await (0, rate_limiter_1.resetRateLimit)(ipAddress);
    // Generate secure session token
    const sessionToken = crypto_1.default.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + config_1.CONFIG.SESSION_TTL_HOURS * 3600 * 1000).toISOString();
    const now = new Date().toISOString();
    await db_1.query.run(`INSERT INTO sessions (id, user_id, expires_at, created_at, user_agent, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`, [sessionToken, user.id, expiresAt, now, userAgent, ipAddress]);
    // Update user last_login_at
    await db_1.query.run(`UPDATE users SET last_login_at = ? WHERE id = ?`, [now, user.id]);
    const permissions = await getUserPermissions(user.id);
    await (0, audit_service_1.logAudit)({
        userId: user.id,
        username: user.username,
        action: 'LOGIN',
        target: 'SESSION',
        status: 'SUCCESS',
        ipAddress,
    });
    return {
        sessionToken,
        user: {
            id: user.id,
            username: user.username,
            role: user.role,
            permissions,
            isActive: true,
            createdAt: user.created_at,
            lastLoginAt: now,
        },
    };
}
async function validateSession(sessionToken) {
    if (!sessionToken)
        return null;
    const row = await db_1.query.get(`SELECT s.id as session_id, s.expires_at, u.id as user_id, u.username, u.role, u.is_active, u.created_at, u.last_login_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND u.is_active = 1`, [sessionToken]);
    if (!row)
        return null;
    // Check expiration
    if (new Date(row.expires_at).getTime() < Date.now()) {
        await db_1.query.run(`DELETE FROM sessions WHERE id = ?`, [sessionToken]);
        return null;
    }
    const permissions = await getUserPermissions(row.user_id);
    return {
        id: row.user_id,
        username: row.username,
        role: row.role,
        permissions,
        isActive: true,
        createdAt: row.created_at,
        lastLoginAt: row.last_login_at,
    };
}
async function destroySession(sessionToken, userId, username, ipAddress = '') {
    await db_1.query.run(`DELETE FROM sessions WHERE id = ?`, [sessionToken]);
    if (username) {
        await (0, audit_service_1.logAudit)({
            userId,
            username,
            action: 'LOGOUT',
            target: 'SESSION',
            status: 'SUCCESS',
            ipAddress,
        });
    }
}
