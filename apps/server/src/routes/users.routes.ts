import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { requirePermission } from '../security/rbac-middleware';
import { PERMISSIONS, ROLE_DEFAULT_PERMISSIONS, Role, Permission } from '@android-server/shared';
import { query } from '../database/db';
import { getUserPermissions } from '../auth/auth-service';
import { logAudit } from '../audit/audit-service';

export const usersRouter = Router();

// All routes here require USERS_MANAGE permission
usersRouter.use(requirePermission(PERMISSIONS.USERS_MANAGE));

// GET /api/users
usersRouter.get('/', async (req, res) => {
  try {
    const rows = await query.all<{
      id: string;
      username: string;
      role: Role;
      is_active: number;
      created_at: string;
      last_login_at: string | null;
    }>(`SELECT id, username, role, is_active, created_at, last_login_at FROM users ORDER BY created_at ASC`);

    const users = [];
    for (const r of rows) {
      const perms = await getUserPermissions(r.id);
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users (Create user)
const createUserSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(8).max(128),
  role: z.enum(['ADMIN', 'USER']).default('USER'),
  permissions: z.array(z.string()).optional(),
});

usersRouter.post('/', async (req, res) => {
  try {
    const { username, password, role, permissions } = createUserSchema.parse(req.body);

    const existing = await query.get(`SELECT id FROM users WHERE username = ?`, [username]);
    if (existing) {
      return res.status(400).json({ error: 'Username already exists.' });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);
    const userId = `usr_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();

    await query.run(
      `INSERT INTO users (id, username, password_hash, role, is_active, created_at)
       VALUES (?, ?, ?, ?, 1, ?)`,
      [userId, username, passwordHash, role, now]
    );

    // Assign permissions
    const permsToAssign: Permission[] =
      permissions && permissions.length > 0
        ? (permissions as Permission[])
        : ROLE_DEFAULT_PERMISSIONS[role];

    for (const p of permsToAssign) {
      await query.run(`INSERT OR IGNORE INTO user_permissions (user_id, permission_name) VALUES (?, ?)`, [
        userId,
        p,
      ]);
    }

    await logAudit({
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
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/users/:id
const updateUserSchema = z.object({
  role: z.enum(['ADMIN', 'USER']).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
  permissions: z.array(z.string()).optional(),
});

usersRouter.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { role, isActive, password, permissions } = updateUserSchema.parse(req.body);

    const targetUser = await query.get<{ id: string; username: string }>(
      `SELECT id, username FROM users WHERE id = ?`,
      [id]
    );
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (role !== undefined) {
      await query.run(`UPDATE users SET role = ? WHERE id = ?`, [role, id]);
    }

    if (isActive !== undefined) {
      // Prevent disabling own account
      if (req.user?.id === id && !isActive) {
        return res.status(400).json({ error: 'Cannot disable your own administrator account.' });
      }
      await query.run(`UPDATE users SET is_active = ? WHERE id = ?`, [isActive ? 1 : 0, id]);
    }

    if (password) {
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(password, salt);
      await query.run(`UPDATE users SET password_hash = ? WHERE id = ?`, [passwordHash, id]);
    }

    if (permissions) {
      await query.run(`DELETE FROM user_permissions WHERE user_id = ?`, [id]);
      for (const p of permissions) {
        await query.run(`INSERT OR IGNORE INTO user_permissions (user_id, permission_name) VALUES (?, ?)`, [
          id,
          p,
        ]);
      }
    }

    await logAudit({
      userId: req.user?.id,
      username: req.user?.username || 'admin',
      action: 'PERMISSION_CHANGE',
      target: targetUser.username,
      status: 'SUCCESS',
      ipAddress: req.ip || '',
    });

    res.json({ message: 'User updated successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/users/:id
usersRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user?.id === id) {
      return res.status(400).json({ error: 'Cannot delete your own administrator account.' });
    }

    const targetUser = await query.get<{ id: string; username: string }>(
      `SELECT id, username FROM users WHERE id = ?`,
      [id]
    );
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await query.run(`DELETE FROM users WHERE id = ?`, [id]);

    await logAudit({
      userId: req.user?.id,
      username: req.user?.username || 'admin',
      action: 'USER_DELETE',
      target: targetUser.username,
      status: 'SUCCESS',
      ipAddress: req.ip || '',
    });

    res.json({ message: 'User deleted.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
