import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../security/rbac-middleware';
import { PERMISSIONS } from '@android-server/shared';
import { SystemService } from '../system/system-service';
import { CompanionBridge } from '../android/companion-bridge';
import { logAudit } from '../audit/audit-service';

export const systemRouter = Router();

// GET /api/system/stats
systemRouter.get('/stats', requirePermission(PERMISSIONS.SYSTEM_VIEW), async (req, res) => {
  try {
    const vitals = await SystemService.collectVitals();
    res.json(vitals);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/system/capabilities
systemRouter.get('/capabilities', requirePermission(PERMISSIONS.SYSTEM_VIEW), (req, res) => {
  const caps = CompanionBridge.getCapabilities();
  res.json(caps);
});

// POST /api/system/power
const powerSchema = z.object({
  action: z.enum(['restart', 'shutdown', 'lock', 'sleep']),
});

systemRouter.post('/power', requirePermission(PERMISSIONS.SYSTEM_POWER), async (req, res) => {
  try {
    const { action } = powerSchema.parse(req.body);

    if (action === 'lock') {
      const dispatched = CompanionBridge.sendNavAction('lock');
      await logAudit({
        userId: req.user?.id,
        username: req.user?.username || 'user',
        action: 'POWER_REQUEST',
        target: 'LOCK',
        status: dispatched ? 'SUCCESS' : 'FAILURE',
        ipAddress: req.ip || '',
        details: { method: 'AccessibilityService.GLOBAL_ACTION_LOCK_SCREEN' },
      });
      return res.json({
        success: dispatched,
        message: dispatched ? 'Lock command sent.' : 'Android Companion accessibility service required.',
      });
    }

    const result = await SystemService.handlePowerAction(action);

    await logAudit({
      userId: req.user?.id,
      username: req.user?.username || 'user',
      action: 'POWER_REQUEST',
      target: action.toUpperCase(),
      status: result.success ? 'SUCCESS' : 'DENIED',
      ipAddress: req.ip || '',
      details: result.message,
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
