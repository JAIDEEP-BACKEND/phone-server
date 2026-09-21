"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.query = exports.db = void 0;
exports.initDatabase = initDatabase;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const shared_1 = require("@android-server/shared");
// Ensure data folder exists
const dbDir = path_1.default.dirname(config_1.CONFIG.DATABASE_PATH);
if (!fs_1.default.existsSync(dbDir)) {
    fs_1.default.mkdirSync(dbDir, { recursive: true });
}
let dbSync = null;
let sqlite3Fallback = null;
try {
    // Built-in SQLite available natively in Node.js 22.5+ / 24+ (Zero C++ compilation needed!)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DatabaseSync } = require('node:sqlite');
    dbSync = new DatabaseSync(config_1.CONFIG.DATABASE_PATH);
    dbSync.exec('PRAGMA journal_mode = WAL;');
    dbSync.exec('PRAGMA foreign_keys = ON;');
    console.log(`[DB] Connected to SQLite via native Node engine at ${config_1.CONFIG.DATABASE_PATH}`);
}
catch (e) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const sqlite3 = require('sqlite3');
        sqlite3Fallback = new sqlite3.Database(config_1.CONFIG.DATABASE_PATH, (err) => {
            if (err) {
                console.error('[DB] Failed to open SQLite database:', err.message);
            }
            else {
                console.log(`[DB] Connected to SQLite database at ${config_1.CONFIG.DATABASE_PATH}`);
            }
        });
        sqlite3Fallback.serialize(() => {
            sqlite3Fallback.run('PRAGMA journal_mode = WAL;');
            sqlite3Fallback.run('PRAGMA foreign_keys = ON;');
        });
    }
    catch (err) {
        console.error('[DB] SQLite driver initialization failed:', err?.message || err);
    }
}
exports.db = dbSync || sqlite3Fallback;
exports.query = {
    get(sql, params = []) {
        if (dbSync) {
            try {
                const stmt = dbSync.prepare(sql);
                const row = stmt.get(...params);
                return Promise.resolve(row ? { ...row } : undefined);
            }
            catch (err) {
                return Promise.reject(err);
            }
        }
        if (sqlite3Fallback) {
            return new Promise((resolve, reject) => {
                sqlite3Fallback.get(sql, params, (err, row) => {
                    if (err)
                        reject(err);
                    else
                        resolve(row);
                });
            });
        }
        return Promise.reject(new Error('No SQLite database driver available'));
    },
    all(sql, params = []) {
        if (dbSync) {
            try {
                const stmt = dbSync.prepare(sql);
                const rows = stmt.all(...params);
                return Promise.resolve((rows || []).map((r) => ({ ...r })));
            }
            catch (err) {
                return Promise.reject(err);
            }
        }
        if (sqlite3Fallback) {
            return new Promise((resolve, reject) => {
                sqlite3Fallback.all(sql, params, (err, rows) => {
                    if (err)
                        reject(err);
                    else
                        resolve((rows || []));
                });
            });
        }
        return Promise.reject(new Error('No SQLite database driver available'));
    },
    run(sql, params = []) {
        if (dbSync) {
            try {
                const stmt = dbSync.prepare(sql);
                const res = stmt.run(...params);
                return Promise.resolve({
                    lastID: Number(res.lastInsertRowid || 0),
                    changes: Number(res.changes || 0),
                });
            }
            catch (err) {
                return Promise.reject(err);
            }
        }
        if (sqlite3Fallback) {
            return new Promise((resolve, reject) => {
                sqlite3Fallback.run(sql, params, function (err) {
                    if (err)
                        reject(err);
                    else
                        resolve({ lastID: this.lastID, changes: this.changes });
                });
            });
        }
        return Promise.reject(new Error('No SQLite database driver available'));
    },
    exec(sql) {
        if (dbSync) {
            try {
                dbSync.exec(sql);
                return Promise.resolve();
            }
            catch (err) {
                return Promise.reject(err);
            }
        }
        if (sqlite3Fallback) {
            return new Promise((resolve, reject) => {
                sqlite3Fallback.exec(sql, (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
        }
        return Promise.reject(new Error('No SQLite database driver available'));
    },
};
const schema_1 = require("./schema");
async function initDatabase() {
    await exports.query.exec(schema_1.SCHEMA_SQL);
    // Populate standard permissions
    for (const perm of shared_1.ALL_PERMISSIONS) {
        await exports.query.run(`INSERT OR IGNORE INTO permissions (name, description) VALUES (?, ?)`, [perm, `Permission for ${perm}`]);
    }
    console.log('[DB] Database schema and permissions initialized successfully.');
}
