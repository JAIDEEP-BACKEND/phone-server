"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRateLimit = checkRateLimit;
exports.recordFailedAttempt = recordFailedAttempt;
exports.resetRateLimit = resetRateLimit;
const db_1 = require("../database/db");
const config_1 = require("../config");
async function checkRateLimit(ipAddress) {
    const row = await db_1.query.get(`SELECT attempts_count, locked_until FROM login_attempts WHERE ip_address = ?`, [ipAddress]);
    if (!row) {
        return { isLocked: false, remainingAttempts: config_1.CONFIG.RATE_LIMIT_MAX_ATTEMPTS };
    }
    if (row.locked_until) {
        const lockedUntilTime = new Date(row.locked_until).getTime();
        const now = Date.now();
        if (now < lockedUntilTime) {
            const lockRemainingSeconds = Math.ceil((lockedUntilTime - now) / 1000);
            return { isLocked: true, remainingAttempts: 0, lockRemainingSeconds };
        }
    }
    const remaining = Math.max(0, config_1.CONFIG.RATE_LIMIT_MAX_ATTEMPTS - (row.attempts_count || 0));
    return { isLocked: false, remainingAttempts: remaining };
}
async function recordFailedAttempt(ipAddress) {
    const existing = await db_1.query.get(`SELECT attempts_count FROM login_attempts WHERE ip_address = ?`, [ipAddress]);
    const newCount = (existing?.attempts_count || 0) + 1;
    let lockedUntil = null;
    let lockRemainingSeconds;
    if (newCount >= config_1.CONFIG.RATE_LIMIT_MAX_ATTEMPTS) {
        // Lock for window duration
        const lockExpiry = new Date(Date.now() + config_1.CONFIG.RATE_LIMIT_WINDOW_MS);
        lockedUntil = lockExpiry.toISOString();
        lockRemainingSeconds = Math.ceil(config_1.CONFIG.RATE_LIMIT_WINDOW_MS / 1000);
    }
    await db_1.query.run(`INSERT INTO login_attempts (ip_address, attempts_count, locked_until, last_attempt_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(ip_address) DO UPDATE SET
       attempts_count = ?,
       locked_until = ?,
       last_attempt_at = datetime('now')`, [ipAddress, newCount, lockedUntil, newCount, lockedUntil]);
    return {
        isLocked: !!lockedUntil,
        remainingAttempts: Math.max(0, config_1.CONFIG.RATE_LIMIT_MAX_ATTEMPTS - newCount),
        lockRemainingSeconds,
    };
}
async function resetRateLimit(ipAddress) {
    await db_1.query.run(`DELETE FROM login_attempts WHERE ip_address = ?`, [ipAddress]);
}
