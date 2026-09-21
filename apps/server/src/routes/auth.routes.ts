import { Router } from 'express';
import { z } from 'zod';
import {
  hasAnyAdmin,
  createFirstAdmin,
  login,
  destroySession,
  SESSION_COOKIE_NAME,
} from '../auth/auth-service';
import { CONFIG } from '../config';

export const authRouter = Router();

// GET /api/auth/status
authRouter.get('/status', async (req, res) => {
  try {
    const adminExists = await hasAnyAdmin();
    res.json({
      hasAdmin: adminExists,
      authenticated: !!req.user,
      user: req.user || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/first-admin
const firstAdminSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(8).max(128),
});

authRouter.post('/first-admin', async (req, res) => {
  try {
    const parse = firstAdminSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: 'Invalid username or password length.' });
    }

    const { username, password } = parse.data;
    const user = await createFirstAdmin(username, password, req.ip || '');

    res.json({
      message: 'First administrator configured successfully.',
      user,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/auth/login
const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

authRouter.post('/login', async (req, res) => {
  try {
    const parse = loginSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const { username, password } = parse.data;
    const { sessionToken, user } = await login(
      username,
      password,
      req.ip || '',
      req.headers['user-agent']
    );

    // Set secure HTTP-only cookie
    res.cookie(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
      sameSite: 'lax',
      maxAge: CONFIG.SESSION_TTL_HOURS * 3600 * 1000,
      path: '/',
    });

    res.json({
      message: 'Login successful.',
      user,
      token: sessionToken,
    });
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

// POST /api/auth/logout
authRouter.post('/logout', async (req, res) => {
  if (req.sessionToken) {
    await destroySession(req.sessionToken, req.user?.id, req.user?.username, req.ip);
  }
  res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  res.json({ message: 'Logged out successfully.' });
});

// GET /api/auth/me
authRouter.get('/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ user: req.user });
});
