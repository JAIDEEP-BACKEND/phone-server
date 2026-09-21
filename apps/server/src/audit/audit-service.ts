import crypto from 'crypto';
import { query } from '../database/db';
import { AuditLogEntry, SOCKET_EVENTS } from '@android-server/shared';
import { Server as SocketIOServer } from 'socket.io';

let ioInstance: SocketIOServer | null = null;

export function setAuditSocketIO(io: SocketIOServer) {
  ioInstance = io;
}

export interface CreateAuditLogParams {
  userId?: string | null;
  username: string;
  action: string;
  target: string;
  status: 'SUCCESS' | 'FAILURE' | 'DENIED' | 'ERROR';
  ipAddress: string;
  details?: Record<string, any> | string;
}

// Redact sensitive keys from audit logs
const SENSITIVE_KEYS = ['password', 'token', 'secret', 'clipboard', 'authorization', 'cookie'];

function sanitizeDetails(details?: Record<string, any> | string): string | undefined {
  if (!details) return undefined;
  if (typeof details === 'string') return details;

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(details)) {
    if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  return JSON.stringify(sanitized);
}

export async function logAudit(params: CreateAuditLogParams): Promise<AuditLogEntry> {
  const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = new Date().toISOString();
  const detailsStr = sanitizeDetails(params.details);

  const entry: AuditLogEntry = {
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
    await query.run(
      `INSERT INTO audit_logs (id, timestamp, user_id, username, action, target, status, ip_address, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.id,
        entry.timestamp,
        entry.userId,
        entry.username,
        entry.action,
        entry.target,
        entry.status,
        entry.ipAddress,
        entry.details || null,
      ]
    );

    // Emit live to WebSocket clients with logs.view permission
    if (ioInstance) {
      ioInstance.to('room:logs').emit(SOCKET_EVENTS.ACTIVITY_EVENT, entry);
    }
  } catch (err) {
    console.error('[AUDIT] Failed to persist audit log:', err);
  }

  return entry;
}

export async function getAuditLogs(limit = 100, offset = 0): Promise<{ logs: AuditLogEntry[]; total: number }> {
  const logs = await query.all<AuditLogEntry>(
    `SELECT id, timestamp, user_id as userId, username, action, target, status, ip_address as ipAddress, details
     FROM audit_logs
     ORDER BY timestamp DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );

  const countRow = await query.get<{ count: number }>(`SELECT COUNT(*) as count FROM audit_logs`);
  return { logs, total: countRow?.count || 0 };
}
