import { query } from '../database/db';
import { CONFIG } from '../config';

interface RateLimitStatus {
  isLocked: boolean;
  remainingAttempts: number;
  lockRemainingSeconds?: number;
}

export async function checkRateLimit(ipAddress: string): Promise<RateLimitStatus> {
  const row = await query.get<{
    attempts_count: number;
    locked_until: string | null;
  }>(`SELECT attempts_count, locked_until FROM login_attempts WHERE ip_address = ?`, [ipAddress]);

  if (!row) {
    return { isLocked: false, remainingAttempts: CONFIG.RATE_LIMIT_MAX_ATTEMPTS };
  }

  if (row.locked_until) {
    const lockedUntilTime = new Date(row.locked_until).getTime();
    const now = Date.now();
    if (now < lockedUntilTime) {
      const lockRemainingSeconds = Math.ceil((lockedUntilTime - now) / 1000);
      return { isLocked: true, remainingAttempts: 0, lockRemainingSeconds };
    }
  }

  const remaining = Math.max(0, CONFIG.RATE_LIMIT_MAX_ATTEMPTS - (row.attempts_count || 0));
  return { isLocked: false, remainingAttempts: remaining };
}

export async function recordFailedAttempt(ipAddress: string): Promise<RateLimitStatus> {
  const existing = await query.get<{
    attempts_count: number;
  }>(`SELECT attempts_count FROM login_attempts WHERE ip_address = ?`, [ipAddress]);

  const newCount = (existing?.attempts_count || 0) + 1;
  let lockedUntil: string | null = null;
  let lockRemainingSeconds: number | undefined;

  if (newCount >= CONFIG.RATE_LIMIT_MAX_ATTEMPTS) {
    // Lock for window duration
    const lockExpiry = new Date(Date.now() + CONFIG.RATE_LIMIT_WINDOW_MS);
    lockedUntil = lockExpiry.toISOString();
    lockRemainingSeconds = Math.ceil(CONFIG.RATE_LIMIT_WINDOW_MS / 1000);
  }

  await query.run(
    `INSERT INTO login_attempts (ip_address, attempts_count, locked_until, last_attempt_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(ip_address) DO UPDATE SET
       attempts_count = ?,
       locked_until = ?,
       last_attempt_at = datetime('now')`,
    [ipAddress, newCount, lockedUntil, newCount, lockedUntil]
  );

  return {
    isLocked: !!lockedUntil,
    remainingAttempts: Math.max(0, CONFIG.RATE_LIMIT_MAX_ATTEMPTS - newCount),
    lockRemainingSeconds,
  };
}

export async function resetRateLimit(ipAddress: string): Promise<void> {
  await query.run(`DELETE FROM login_attempts WHERE ip_address = ?`, [ipAddress]);
}
