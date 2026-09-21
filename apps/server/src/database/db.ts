import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config';
import { ALL_PERMISSIONS } from '@android-server/shared';

// Ensure data folder exists
const dbDir = path.dirname(CONFIG.DATABASE_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let dbSync: any = null;
let sqlite3Fallback: any = null;

try {
  // Built-in SQLite available natively in Node.js 22.5+ / 24+ (Zero C++ compilation needed!)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { DatabaseSync } = require('node:sqlite');
  dbSync = new DatabaseSync(CONFIG.DATABASE_PATH);
  dbSync.exec('PRAGMA journal_mode = WAL;');
  dbSync.exec('PRAGMA foreign_keys = ON;');
  console.log(`[DB] Connected to SQLite via native Node engine at ${CONFIG.DATABASE_PATH}`);
} catch (e: any) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sqlite3 = require('sqlite3');
    sqlite3Fallback = new sqlite3.Database(CONFIG.DATABASE_PATH, (err: any) => {
      if (err) {
        console.error('[DB] Failed to open SQLite database:', err.message);
      } else {
        console.log(`[DB] Connected to SQLite database at ${CONFIG.DATABASE_PATH}`);
      }
    });

    sqlite3Fallback.serialize(() => {
      sqlite3Fallback.run('PRAGMA journal_mode = WAL;');
      sqlite3Fallback.run('PRAGMA foreign_keys = ON;');
    });
  } catch (err: any) {
    console.error('[DB] SQLite driver initialization failed:', err?.message || err);
  }
}

export const db = dbSync || sqlite3Fallback;

export const query = {
  get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    if (dbSync) {
      try {
        const stmt = dbSync.prepare(sql);
        const row = stmt.get(...params);
        return Promise.resolve(row ? ({ ...row } as T) : undefined);
      } catch (err) {
        return Promise.reject(err);
      }
    }
    if (sqlite3Fallback) {
      return new Promise((resolve, reject) => {
        sqlite3Fallback.get(sql, params, (err: any, row: any) => {
          if (err) reject(err);
          else resolve(row as T);
        });
      });
    }
    return Promise.reject(new Error('No SQLite database driver available'));
  },

  all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (dbSync) {
      try {
        const stmt = dbSync.prepare(sql);
        const rows = stmt.all(...params);
        return Promise.resolve((rows || []).map((r: any) => ({ ...r })) as T[]);
      } catch (err) {
        return Promise.reject(err);
      }
    }
    if (sqlite3Fallback) {
      return new Promise((resolve, reject) => {
        sqlite3Fallback.all(sql, params, (err: any, rows: any) => {
          if (err) reject(err);
          else resolve((rows || []) as T[]);
        });
      });
    }
    return Promise.reject(new Error('No SQLite database driver available'));
  },

  run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
    if (dbSync) {
      try {
        const stmt = dbSync.prepare(sql);
        const res = stmt.run(...params);
        return Promise.resolve({
          lastID: Number(res.lastInsertRowid || 0),
          changes: Number(res.changes || 0),
        });
      } catch (err) {
        return Promise.reject(err);
      }
    }
    if (sqlite3Fallback) {
      return new Promise((resolve, reject) => {
        sqlite3Fallback.run(sql, params, function (this: any, err: any) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    }
    return Promise.reject(new Error('No SQLite database driver available'));
  },

  exec(sql: string): Promise<void> {
    if (dbSync) {
      try {
        dbSync.exec(sql);
        return Promise.resolve();
      } catch (err) {
        return Promise.reject(err);
      }
    }
    if (sqlite3Fallback) {
      return new Promise((resolve, reject) => {
        sqlite3Fallback.exec(sql, (err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
    return Promise.reject(new Error('No SQLite database driver available'));
  },
};

import { SCHEMA_SQL } from './schema';

export async function initDatabase(): Promise<void> {
  await query.exec(SCHEMA_SQL);

  // Populate standard permissions
  for (const perm of ALL_PERMISSIONS) {
    await query.run(
      `INSERT OR IGNORE INTO permissions (name, description) VALUES (?, ?)`,
      [perm, `Permission for ${perm}`]
    );
  }

  console.log('[DB] Database schema and permissions initialized successfully.');
}

