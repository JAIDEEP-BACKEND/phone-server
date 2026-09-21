"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.movePathSafely = movePathSafely;
const fs_1 = __importDefault(require("fs"));
/**
 * Moves a file or directory across filesystems safely.
 *
 * When moving between different mount points (e.g. /data/data/com.termux and /storage/emulated/0),
 * Linux returns EXDEV ("cross-device link not permitted").
 * This helper attempts an atomic rename first, and automatically falls back to copy+delete.
 */
async function movePathSafely(sourcePath, targetPath) {
    try {
        await fs_1.default.promises.rename(sourcePath, targetPath);
    }
    catch (err) {
        if (err.code === 'EXDEV' || err.code === 'EPERM' || err.code === 'EACCES') {
            const stat = await fs_1.default.promises.stat(sourcePath);
            if (stat.isDirectory()) {
                await fs_1.default.promises.cp(sourcePath, targetPath, { recursive: true });
                await fs_1.default.promises.rm(sourcePath, { recursive: true, force: true });
            }
            else {
                await fs_1.default.promises.copyFile(sourcePath, targetPath);
                await fs_1.default.promises.unlink(sourcePath);
            }
        }
        else {
            throw err;
        }
    }
}
