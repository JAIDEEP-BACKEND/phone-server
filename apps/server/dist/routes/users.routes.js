"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const rbac_middleware_1 = require("../security/rbac-middleware");
const shared_1 = require("@android-server/shared");
const db_1 = require("../database/db");
const auth_service_1 = require("../auth/auth-service");
const audit_service_1 = require("../audit/audit-service");
exports.usersRouter = (0, express_1.Router)();
// All routes here require USERS_MANAGE permission
exports.usersRouter.use((0, rbac_middleware_1.requirePermission)(shared_1.PERMISSIONS.USERS_MANAGE));
// GET /api/users
exports.usersRouter.get('/', async (req, res) => {
    try {
        const rows = await db_1.query.all(`SELECT id, username, role, is_active, created_at, last_login_at FROM users ORDER BY created_at ASC`);
        const users = [];
        for (const r of rows) {
            const perms = await (0, auth_service_1.getUserPermissions)(r.id);
            users.push({
                id: r.id,
                username: r.username,
                role: r.role,
                isActive: r.is_active === 1,
                createdAt: r.created_at,
                lastLoginAt: r.last_login_at,
                permissions: perms,
            });
        }
        res.json({ users });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// POST /api/users (Create user)
const createUserSchema = zod_1.z.object({
    username: zod_1.z.string().min(3).max(32),
    password: zod_1.z.string().min(8).max(128),
    role: zod_1.z.enum(['ADMIN', 'USER']).default('USER'),
    permissions: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.usersRouter.post('/', async (req, res) => {
    try {
        const { username, password, role, permissions } = createUserSchema.parse(req.body);
        const existing = await db_1.query.get(`SELECT id FROM users WHERE username = ?`, [username]);
        if (existing) {
            return res.status(400).json({ error: 'Username already exists.' });
        }
        const salt = await bcryptjs_1.default.genSalt(12);
        const passwordHash = await bcryptjs_1.default.hash(password, salt);
        const userId = `usr_${crypto_1.default.randomBytes(8).toString('hex')}`;
        const now = new Date().toISOString();
        await db_1.query.run(`INSERT INTO users (id, username, password_hash, role, is_active, created_at)
       VALUES (?, ?, ?, ?, 1, ?)`, [userId, username, passwordHash, role, now]);
        // Assign permissions
        const permsToAssign = permissions && permissions.length > 0
            ? permissions
            : shared_1.ROLE_DEFAULT_PERMISSIONS[role];
        for (const p of permsToAssign) {
            await db_1.query.run(`INSERT OR IGNORE INTO user_permissions (user_id, permission_name) VALUES (?, ?)`, [
                userId,
                p,
            ]);
        }
        await (0, audit_service_1.logAudit)({
            userId: req.user?.id,
            username: req.user?.username || 'admin',
            action: 'USER_CREATE',
            target: username,
            status: 'SUCCESS',
            ipAddress: req.ip || '',
            details: { role, permissionsCount: permsToAssign.length },
        });
        res.json({
            message: 'User created successfully.',
            user: {
                id: userId,
                username,
                role,
                isActive: true,
                createdAt: now,
                lastLoginAt: null,
                permissions: permsToAssign,
            },
        });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// PATCH /api/users/:id
const updateUserSchema = zod_1.z.object({
    role: zod_1.z.enum(['ADMIN', 'USER']).optional(),
    isActive: zod_1.z.boolean().optional(),
    password: zod_1.z.string().min(8).optional(),
    permissions: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.usersRouter.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { role, isActive, password, permissions } = updateUserSchema.parse(req.body);
        const targetUser = await db_1.query.get(`SELECT id, username FROM users WHERE id = ?`, [id]);
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found.' });
        }
        if (role !== undefined) {
            await db_1.query.run(`UPDATE users SET role = ? WHERE id = ?`, [role, id]);
        }
        if (isActive !== undefined) {
            // Prevent disabling own account
            if (req.user?.id === id && !isActive) {
                return res.status(400).json({ error: 'Cannot disable your own administrator account.' });
            }
            await db_1.query.run(`UPDATE users SET is_active = ? WHERE id = ?`, [isActive ? 1 : 0, id]);
        }
        if (password) {
            const salt = await bcryptjs_1.default.genSalt(12);
            const passwordHash = await bcryptjs_1.default.hash(password, salt);
            await db_1.query.run(`UPDATE users SET password_hash = ? WHERE id = ?`, [passwordHash, id]);
        }
        if (permissions) {
            await db_1.query.run(`DELETE FROM user_permissions WHERE user_id = ?`, [id]);
            for (const p of permissions) {
                await db_1.query.run(`INSERT OR IGNORE INTO user_permissions (user_id, permission_name) VALUES (?, ?)`, [
                    id,
                    p,
                ]);
            }
        }
        await (0, audit_service_1.logAudit)({
            userId: req.user?.id,
            username: req.user?.username || 'admin',
            action: 'PERMISSION_CHANGE',
            target: targetUser.username,
            status: 'SUCCESS',
            ipAddress: req.ip || '',
        });
        res.json({ message: 'User updated successfully.' });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// DELETE /api/users/:id
exports.usersRouter.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (req.user?.id === id) {
            return res.status(400).json({ error: 'Cannot delete your own administrator account.' });
        }
        const targetUser = await db_1.query.get(`SELECT id, username FROM users WHERE id = ?`, [id]);
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found.' });
        }
        await db_1.query.run(`DELETE FROM users WHERE id = ?`, [id]);
        await (0, audit_service_1.logAudit)({
            userId: req.user?.id,
            username: req.user?.username || 'admin',
            action: 'USER_DELETE',
            target: targetUser.username,
            status: 'SUCCESS',
            ipAddress: req.ip || '',
        });
        res.json({ message: 'User deleted.' });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
