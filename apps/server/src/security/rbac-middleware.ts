import { Request, Response, NextFunction } from 'express';
import { Permission, UserProfile } from '@android-server/shared';
import { SESSION_COOKIE_NAME, validateSession } from '../auth/auth-service';
import { logAudit } from '../audit/audit-service';

declare global {
  namespace Express {
    interface Request {
      user?: UserProfile;
      sessionToken?: string;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token =
    req.cookies?.[SESSION_COOKIE_NAME] ||
    req.signedCookies?.[SESSION_COOKIE_NAME] ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : undefined);

  if (!token) {
    return next();
  }

  try {
    const user = await validateSession(token);
    if (user) {
      req.user = user;
      req.sessionToken = token;
    }
  } catch (err) {
    console.error('[AUTH] Error during session validation:', err);
  }

  next();
}

export function requireAuth() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required.',
        code: 'UNAUTHENTICATED',
      });
    }
    next();
  };
}

export function requirePermission(permission: Permission) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required.',
        code: 'UNAUTHENTICATED',
      });
    }

    const hasPermission =
      req.user.role === 'ADMIN' || req.user.permissions.includes(permission);

    if (!hasPermission) {
      await logAudit({
        userId: req.user.id,
        username: req.user.username,
        action: 'PERMISSION_DENIED',
        target: permission,
        status: 'DENIED',
        ipAddress: req.ip || '',
        details: `Attempted to access action requiring '${permission}'`,
      });

      return res.status(403).json({
        error: `Permission denied: ${permission}`,
        code: 'FORBIDDEN',
        requiredPermission: permission,
      });
    }

    next();
  };
}
