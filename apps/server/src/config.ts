import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load .env if present
dotenv.config();

const isAndroid = process.platform === 'android' || fs.existsSync('/data/data/com.termux');

// Target storage root
let defaultStorageRoot = '/storage/emulated/0';
if (!fs.existsSync(defaultStorageRoot)) {
  // If not on an Android device or running on test machine, use ./storage
  defaultStorageRoot = path.resolve(process.cwd(), 'storage');
  if (!fs.existsSync(defaultStorageRoot)) {
    fs.mkdirSync(defaultStorageRoot, { recursive: true });
  }
}

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  HOST: process.env.HOST || '0.0.0.0',
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_ANDROID: isAndroid,

  DATABASE_PATH: process.env.DATABASE_PATH || path.resolve(process.cwd(), 'data', 'server.sqlite'),
  STORAGE_ROOT: path.resolve(process.env.STORAGE_ROOT || defaultStorageRoot),

  SESSION_SECRET: process.env.SESSION_SECRET || 'dev-session-secret-key-32-chars-minimum!!',
  COOKIE_SECRET: process.env.COOKIE_SECRET || 'dev-cookie-secret-key-32-chars-minimum!!',
  SESSION_TTL_HOURS: 24,

  MAX_UPLOAD_SIZE_MB: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '2048', 10),

  COMPANION_PORT: parseInt(process.env.COMPANION_PORT || '3002', 10),
  COMPANION_SECRET: process.env.COMPANION_SECRET || 'android-companion-pairing-secret',

  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 mins
  RATE_LIMIT_MAX_ATTEMPTS: parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS || '5', 10),
};
