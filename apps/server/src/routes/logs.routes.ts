import { Router } from 'express';
import { requirePermission } from '../security/rbac-middleware';
import { PERMISSIONS } from '@android-server/shared';
import { getAuditLogs } from '../audit/audit-service';

export const logsRouter = Router();

// GET /api/logs
logsRouter.get('/', requirePermission(PERMISSIONS.LOGS_VIEW), async (req, res) => {
  try {
    const limit = parseInt((req.query.limit as string) || '100', 10);
    const offset = parseInt((req.query.offset as string) || '0', 10);
    const result = await getAuditLogs(Math.min(500, limit), Math.max(0, offset));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
