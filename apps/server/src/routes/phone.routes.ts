import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../security/rbac-middleware';
import { PERMISSIONS } from '@android-server/shared';
import { CompanionBridge } from '../android/companion-bridge';
import { logAudit } from '../audit/audit-service';

export const phoneRouter = Router();

// GET /api/phone/info
phoneRouter.get('/info', requirePermission(PERMISSIONS.SYSTEM_VIEW), (req, res) => {
  const info = CompanionBridge.getDeviceInfo();
  res.json(info);
});

// GET /api/phone/apps
phoneRouter.get('/apps', requirePermission(PERMISSIONS.PHONE_APPS), (req, res) => {
  const apps = CompanionBridge.getInstalledApps();
  res.json(apps);
});

// POST /api/phone/launch
const launchSchema = z.object({
  packageName: z.string(),
});

phoneRouter.post('/launch', requirePermission(PERMISSIONS.PHONE_APPS), async (req, res) => {
  try {
    const { packageName } = launchSchema.parse(req.body);
    const success = CompanionBridge.launchApp(packageName);

    await logAudit({
      userId: req.user?.id,
      username: req.user?.username || 'user',
      action: 'APP_LAUNCH',
      target: packageName,
      status: success ? 'SUCCESS' : 'FAILURE',
      ipAddress: req.ip || '',
    });

    if (!success) {
      return res.status(400).json({ error: 'Failed to launch application or Companion app disconnected.' });
    }

    res.json({ message: `Launched ${packageName}` });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/phone/notifications
phoneRouter.get('/notifications', requirePermission(PERMISSIONS.PHONE_NOTIFICATIONS), (req, res) => {
  const notifications = CompanionBridge.getNotifications();
  res.json(notifications);
});

// GET /api/phone/clipboard
phoneRouter.get('/clipboard', requirePermission(PERMISSIONS.PHONE_CLIPBOARD), (req, res) => {
  const success = CompanionBridge.requestClipboard();
  res.json({ success, message: success ? 'Clipboard fetch requested.' : 'Unable to read phone clipboard.' });
});

// POST /api/phone/clipboard
const clipboardSchema = z.object({
  text: z.string(),
});

phoneRouter.post('/clipboard', requirePermission(PERMISSIONS.PHONE_CLIPBOARD), (req, res) => {
  try {
    const { text } = clipboardSchema.parse(req.body);
    const success = CompanionBridge.writeClipboard(text);
    res.json({ success, message: success ? 'Clipboard set on device.' : 'Failed to set clipboard.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
