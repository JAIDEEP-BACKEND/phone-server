import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config';
import { ALL_PERMISSIONS } from '@android-server/shared';

// Ensure data folder exists
const dbDir = path.dirname(CONFIG.DATABASE_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new sqlite3.Database(CONFIG.DATABASE_PATH, (err) => {
  if (err) {
    console.error('[DB] Failed to open SQLite database:', err.message);
  } else {
    console.log(`[DB] Connected to SQLite database at ${CONFIG.DATABASE_PATH}`);
  }
});

// Enable WAL mode and foreign keys for performance and data integrity
db.serialize(() => {
  db.run('PRAGMA journal_mode = WAL;');
  db.run('PRAGMA foreign_keys = ON;');
});

export const query = {
  get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T);
      });
    });
  },

  all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve((rows || []) as T[]);
      });
    });
  },

  run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },

  exec(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },
};

export async function initDatabase(): Promise<void> {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  await query.exec(schemaSql);

  // Populate standard permissions
  for (const perm of ALL_PERMISSIONS) {
    await query.run(
      `INSERT OR IGNORE INTO permissions (name, description) VALUES (?, ?)`,
      [perm, `Permission for ${perm}`]
    );
  }

  console.log('[DB] Database schema and permissions initialized successfully.');
}
