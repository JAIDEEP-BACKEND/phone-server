import { Router } from 'express';
import { requirePermission } from '../security/rbac-middleware';
import { PERMISSIONS } from '@android-server/shared';
import { DeviceInfoService } from '../system/device-info';

export const phoneRouter = Router();

// GET /api/phone/info
phoneRouter.get('/info', requirePermission(PERMISSIONS.SYSTEM_VIEW), (req, res) => {
  const info = DeviceInfoService.getDeviceInfo();
  res.json(info);
});
