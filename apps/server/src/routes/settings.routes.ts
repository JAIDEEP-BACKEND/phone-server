import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../security/rbac-middleware';
import { PERMISSIONS } from '@android-server/shared';
import { query } from '../database/db';
import { CONFIG } from '../config';
import { logAudit } from '../audit/audit-service';

export const settingsRouter = Router();

// GET /api/settings
settingsRouter.get('/', requirePermission(PERMISSIONS.SETTINGS_MANAGE), async (req, res) => {
  try {
    const rows = await query.all<{ key: string; value: string; updated_at: string }>(
      `SELECT key, value, updated_at FROM settings`
    );

    const settingsMap: Record<string, string> = {
      serverPort: CONFIG.PORT.toString(),
      storageRoot: CONFIG.STORAGE_ROOT,
      maxUploadSizeMb: CONFIG.MAX_UPLOAD_SIZE_MB.toString(),
      sessionTtlHours: CONFIG.SESSION_TTL_HOURS.toString(),
      deviceName: 'OPPO Android Server',
      rateLimitAttempts: CONFIG.RATE_LIMIT_MAX_ATTEMPTS.toString(),
    };

    for (const r of rows) {
      settingsMap[r.key] = r.value;
    }

    res.json({ settings: settingsMap });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/settings
const updateSettingsSchema = z.record(z.string(), z.string());

settingsRouter.post('/', requirePermission(PERMISSIONS.SETTINGS_MANAGE), async (req, res) => {
  try {
    const data = updateSettingsSchema.parse(req.body);
    const now = new Date().toISOString();

    for (const [key, value] of Object.entries(data)) {
      await query.run(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?`,
        [key, value, now, value, now]
      );
    }

    await logAudit({
      userId: req.user?.id,
      username: req.user?.username || 'admin',
      action: 'SETTINGS_UPDATE',
      target: Object.keys(data).join(', '),
      status: 'SUCCESS',
      ipAddress: req.ip || '',
    });

    res.json({ message: 'Settings updated successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
