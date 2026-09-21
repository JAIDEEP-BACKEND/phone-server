"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.phoneRouter = void 0;
const express_1 = require("express");
const rbac_middleware_1 = require("../security/rbac-middleware");
const shared_1 = require("@android-server/shared");
const device_info_1 = require("../system/device-info");
exports.phoneRouter = (0, express_1.Router)();
// GET /api/phone/info
exports.phoneRouter.get('/info', (0, rbac_middleware_1.requirePermission)(shared_1.PERMISSIONS.SYSTEM_VIEW), (req, res) => {
    const info = device_info_1.DeviceInfoService.getDeviceInfo();
    res.json(info);
});
