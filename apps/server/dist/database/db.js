"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.query = exports.db = void 0;
exports.initDatabase = initDatabase;
const sqlite3_1 = __importDefault(require("sqlite3"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const shared_1 = require("@android-server/shared");
// Ensure data folder exists
const dbDir = path_1.default.dirname(config_1.CONFIG.DATABASE_PATH);
if (!fs_1.default.existsSync(dbDir)) {
    fs_1.default.mkdirSync(dbDir, { recursive: true });
}
exports.db = new sqlite3_1.default.Database(config_1.CONFIG.DATABASE_PATH, (err) => {
    if (err) {
        console.error('[DB] Failed to open SQLite database:', err.message);
    }
    else {
        console.log(`[DB] Connected to SQLite database at ${config_1.CONFIG.DATABASE_PATH}`);
    }
});
// Enable WAL mode and foreign keys for performance and data integrity
exports.db.serialize(() => {
    exports.db.run('PRAGMA journal_mode = WAL;');
    exports.db.run('PRAGMA foreign_keys = ON;');
});
exports.query = {
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            exports.db.get(sql, params, (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(row);
            });
        });
    },
    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            exports.db.all(sql, params, (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve((rows || []));
            });
        });
    },
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            exports.db.run(sql, params, function (err) {
                if (err)
                    reject(err);
                else
                    resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    },
    exec(sql) {
        return new Promise((resolve, reject) => {
            exports.db.exec(sql, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    },
};
async function initDatabase() {
    const schemaPath = path_1.default.join(__dirname, 'schema.sql');
    const schemaSql = fs_1.default.readFileSync(schemaPath, 'utf8');
    await exports.query.exec(schemaSql);
    // Populate standard permissions
    for (const perm of shared_1.ALL_PERMISSIONS) {
        await exports.query.run(`INSERT OR IGNORE INTO permissions (name, description) VALUES (?, ?)`, [perm, `Permission for ${perm}`]);
    }
    console.log('[DB] Database schema and permissions initialized successfully.');
}
