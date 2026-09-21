"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const rbac_middleware_1 = require("../security/rbac-middleware");
const shared_1 = require("@android-server/shared");
const system_service_1 = require("../system/system-service");
const audit_service_1 = require("../audit/audit-service");
exports.systemRouter = (0, express_1.Router)();
// GET /api/system/stats
exports.systemRouter.get('/stats', (0, rbac_middleware_1.requirePermission)(shared_1.PERMISSIONS.SYSTEM_VIEW), async (req, res) => {
    try {
        const vitals = await system_service_1.SystemService.collectVitals();
        res.json(vitals);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// POST /api/system/power
const powerSchema = zod_1.z.object({
    action: zod_1.z.enum(['restart', 'shutdown', 'lock', 'sleep']),
});
exports.systemRouter.post('/power', (0, rbac_middleware_1.requirePermission)(shared_1.PERMISSIONS.SYSTEM_POWER), async (req, res) => {
    try {
        const { action } = powerSchema.parse(req.body);
        const result = await system_service_1.SystemService.handlePowerAction(action);
        await (0, audit_service_1.logAudit)({
            userId: req.user?.id,
            username: req.user?.username || 'user',
            action: 'POWER_REQUEST',
            target: action.toUpperCase(),
            status: result.success ? 'SUCCESS' : 'DENIED',
            ipAddress: req.ip || '',
            details: result.message,
        });
        res.json(result);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
