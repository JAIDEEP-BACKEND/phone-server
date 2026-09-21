"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const rbac_middleware_1 = require("../security/rbac-middleware");
const shared_1 = require("@android-server/shared");
const db_1 = require("../database/db");
const config_1 = require("../config");
const audit_service_1 = require("../audit/audit-service");
exports.settingsRouter = (0, express_1.Router)();
// GET /api/settings
exports.settingsRouter.get('/', (0, rbac_middleware_1.requirePermission)(shared_1.PERMISSIONS.SETTINGS_MANAGE), async (req, res) => {
    try {
        const rows = await db_1.query.all(`SELECT key, value, updated_at FROM settings`);
        const settingsMap = {
            serverPort: config_1.CONFIG.PORT.toString(),
            storageRoot: config_1.CONFIG.STORAGE_ROOT,
            maxUploadSizeMb: config_1.CONFIG.MAX_UPLOAD_SIZE_MB.toString(),
            sessionTtlHours: config_1.CONFIG.SESSION_TTL_HOURS.toString(),
            deviceName: 'OPPO Android Server',
            rateLimitAttempts: config_1.CONFIG.RATE_LIMIT_MAX_ATTEMPTS.toString(),
        };
        for (const r of rows) {
            settingsMap[r.key] = r.value;
        }
        res.json({ settings: settingsMap });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// POST /api/settings
const updateSettingsSchema = zod_1.z.record(zod_1.z.string(), zod_1.z.string());
exports.settingsRouter.post('/', (0, rbac_middleware_1.requirePermission)(shared_1.PERMISSIONS.SETTINGS_MANAGE), async (req, res) => {
    try {
        const data = updateSettingsSchema.parse(req.body);
        const now = new Date().toISOString();
        for (const [key, value] of Object.entries(data)) {
            await db_1.query.run(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?`, [key, value, now, value, now]);
        }
        await (0, audit_service_1.logAudit)({
            userId: req.user?.id,
            username: req.user?.username || 'admin',
            action: 'SETTINGS_UPDATE',
            target: Object.keys(data).join(', '),
            status: 'SUCCESS',
            ipAddress: req.ip || '',
        });
        res.json({ message: 'Settings updated successfully.' });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
