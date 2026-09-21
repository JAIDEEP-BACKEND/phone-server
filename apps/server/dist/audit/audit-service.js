"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setAuditSocketIO = setAuditSocketIO;
exports.logAudit = logAudit;
exports.getAuditLogs = getAuditLogs;
const db_1 = require("../database/db");
const shared_1 = require("@android-server/shared");
let ioInstance = null;
function setAuditSocketIO(io) {
    ioInstance = io;
}
// Redact sensitive keys from audit logs
const SENSITIVE_KEYS = ['password', 'token', 'secret', 'clipboard', 'authorization', 'cookie'];
function sanitizeDetails(details) {
    if (!details)
        return undefined;
    if (typeof details === 'string')
        return details;
    const sanitized = {};
    for (const [key, value] of Object.entries(details)) {
        if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))) {
            sanitized[key] = '[REDACTED]';
        }
        else {
            sanitized[key] = value;
        }
    }
    return JSON.stringify(sanitized);
}
async function logAudit(params) {
    const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString();
    const detailsStr = sanitizeDetails(params.details);
    const entry = {
        id,
        timestamp,
        userId: params.userId || null,
        username: params.username,
        action: params.action,
        target: params.target,
        status: params.status,
        ipAddress: params.ipAddress,
        details: detailsStr,
    };
    try {
        await db_1.query.run(`INSERT INTO audit_logs (id, timestamp, user_id, username, action, target, status, ip_address, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            entry.id,
            entry.timestamp,
            entry.userId,
            entry.username,
            entry.action,
            entry.target,
            entry.status,
            entry.ipAddress,
            entry.details || null,
        ]);
        // Emit live to WebSocket clients with logs.view permission
        if (ioInstance) {
            ioInstance.to('room:logs').emit(shared_1.SOCKET_EVENTS.ACTIVITY_EVENT, entry);
        }
    }
    catch (err) {
        console.error('[AUDIT] Failed to persist audit log:', err);
    }
    return entry;
}
async function getAuditLogs(limit = 100, offset = 0) {
    const logs = await db_1.query.all(`SELECT id, timestamp, user_id as userId, username, action, target, status, ip_address as ipAddress, details
     FROM audit_logs
     ORDER BY timestamp DESC
     LIMIT ? OFFSET ?`, [limit, offset]);
    const countRow = await db_1.query.get(`SELECT COUNT(*) as count FROM audit_logs`);
    return { logs, total: countRow?.count || 0 };
}
