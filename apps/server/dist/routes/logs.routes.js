"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logsRouter = void 0;
const express_1 = require("express");
const rbac_middleware_1 = require("../security/rbac-middleware");
const shared_1 = require("@android-server/shared");
const audit_service_1 = require("../audit/audit-service");
exports.logsRouter = (0, express_1.Router)();
// GET /api/logs
exports.logsRouter.get('/', (0, rbac_middleware_1.requirePermission)(shared_1.PERMISSIONS.LOGS_VIEW), async (req, res) => {
    try {
        const limit = parseInt(req.query.limit || '100', 10);
        const offset = parseInt(req.query.offset || '0', 10);
        const result = await (0, audit_service_1.getAuditLogs)(Math.min(500, limit), Math.max(0, offset));
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
