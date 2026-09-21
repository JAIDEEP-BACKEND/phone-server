"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.requireAuth = requireAuth;
exports.requirePermission = requirePermission;
const auth_service_1 = require("../auth/auth-service");
const audit_service_1 = require("../audit/audit-service");
async function authMiddleware(req, res, next) {
    const token = req.cookies?.[auth_service_1.SESSION_COOKIE_NAME] ||
        req.signedCookies?.[auth_service_1.SESSION_COOKIE_NAME] ||
        (req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.split(' ')[1]
            : undefined);
    if (!token) {
        return next();
    }
    try {
        const user = await (0, auth_service_1.validateSession)(token);
        if (user) {
            req.user = user;
            req.sessionToken = token;
        }
    }
    catch (err) {
        console.error('[AUTH] Error during session validation:', err);
    }
    next();
}
function requireAuth() {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required.',
                code: 'UNAUTHENTICATED',
            });
        }
        next();
    };
}
function requirePermission(permission) {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required.',
                code: 'UNAUTHENTICATED',
            });
        }
        const hasPermission = req.user.role === 'ADMIN' || req.user.permissions.includes(permission);
        if (!hasPermission) {
            await (0, audit_service_1.logAudit)({
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
