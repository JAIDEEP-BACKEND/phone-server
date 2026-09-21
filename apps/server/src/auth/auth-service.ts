import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../database/db';
import { CONFIG } from '../config';
import { Permission, Role, ROLE_DEFAULT_PERMISSIONS, UserProfile } from '@android-server/shared';
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from '../security/rate-limiter';
import { logAudit } from '../audit/audit-service';

export const SESSION_COOKIE_NAME = 'nas_session_id';

export async function hasAnyAdmin(): Promise<boolean> {
  const row = await query.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM users WHERE role = 'ADMIN' AND is_active = 1`
  );
  return (row?.count || 0) > 0;
}

export async function getUserPermissions(userId: string): Promise<Permission[]> {
  const rows = await query.all<{ permission_name: Permission }>(
    `SELECT permission_name FROM user_permissions WHERE user_id = ?`,
    [userId]
  );
  return rows.map((r) => r.permission_name);
}

export async function createFirstAdmin(
  username: string,
  passwordPlain: string,
  ipAddress: string
): Promise<UserProfile> {
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

  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(passwordPlain, salt);
  const userId = `usr_${crypto.randomBytes(8).toString('hex')}`;
  const now = new Date().toISOString();

  await query.run(
    `INSERT INTO users (id, username, password_hash, role, is_active, created_at)
     VALUES (?, ?, ?, 'ADMIN', 1, ?)`,
    [userId, username.trim(), passwordHash, now]
  );

  // Assign all admin permissions
  const adminPermissions = ROLE_DEFAULT_PERMISSIONS.ADMIN;
  for (const perm of adminPermissions) {
    await query.run(
      `INSERT INTO user_permissions (user_id, permission_name) VALUES (?, ?)`,
      [userId, perm]
    );
  }

  await logAudit({
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

export async function login(
  username: string,
  passwordPlain: string,
  ipAddress: string,
  userAgent: string = ''
): Promise<{ sessionToken: string; user: UserProfile }> {
  // Check rate limit
  const rateLimit = await checkRateLimit(ipAddress);
  if (rateLimit.isLocked) {
    await logAudit({
      username: username || 'unknown',
      action: 'LOGIN_LOCKOUT',
      target: ipAddress,
      status: 'DENIED',
      ipAddress,
      details: `Account temporarily locked. Retry in ${rateLimit.lockRemainingSeconds} seconds.`,
    });
    throw new Error(`Too many failed login attempts. Try again in ${rateLimit.lockRemainingSeconds}s.`);
  }

  const user = await query.get<{
    id: string;
    username: string;
    password_hash: string;
    role: Role;
    is_active: number;
    created_at: string;
    last_login_at: string | null;
  }>(`SELECT * FROM users WHERE username = ?`, [username]);

  if (!user || user.is_active !== 1) {
    await recordFailedAttempt(ipAddress);
    await logAudit({
      username: username || 'unknown',
      action: 'AUTH_FAILURE',
      target: 'CREDENTIALS',
      status: 'FAILURE',
      ipAddress,
      details: 'Invalid username or inactive account',
    });
    throw new Error('Invalid username or password.');
  }

  const isValidPassword = await bcrypt.compare(passwordPlain, user.password_hash);
  if (!isValidPassword) {
    const status = await recordFailedAttempt(ipAddress);
    await logAudit({
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
  await resetRateLimit(ipAddress);

  // Generate secure session token
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + CONFIG.SESSION_TTL_HOURS * 3600 * 1000).toISOString();
  const now = new Date().toISOString();

  await query.run(
    `INSERT INTO sessions (id, user_id, expires_at, created_at, user_agent, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionToken, user.id, expiresAt, now, userAgent, ipAddress]
  );

  // Update user last_login_at
  await query.run(`UPDATE users SET last_login_at = ? WHERE id = ?`, [now, user.id]);

  const permissions = await getUserPermissions(user.id);

  await logAudit({
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

export async function validateSession(sessionToken: string): Promise<UserProfile | null> {
  if (!sessionToken) return null;

  const row = await query.get<{
    session_id: string;
    expires_at: string;
    user_id: string;
    username: string;
    role: Role;
    is_active: number;
    created_at: string;
    last_login_at: string | null;
  }>(
    `SELECT s.id as session_id, s.expires_at, u.id as user_id, u.username, u.role, u.is_active, u.created_at, u.last_login_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND u.is_active = 1`,
    [sessionToken]
  );

  if (!row) return null;

  // Check expiration
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await query.run(`DELETE FROM sessions WHERE id = ?`, [sessionToken]);
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

export async function destroySession(sessionToken: string, userId?: string, username?: string, ipAddress = ''): Promise<void> {
  await query.run(`DELETE FROM sessions WHERE id = ?`, [sessionToken]);
  if (username) {
    await logAudit({
      userId,
      username,
      action: 'LOGOUT',
      target: 'SESSION',
      status: 'SUCCESS',
      ipAddress,
    });
  }
}
