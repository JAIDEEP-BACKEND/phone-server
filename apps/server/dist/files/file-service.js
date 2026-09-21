"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const mime_types_1 = __importDefault(require("mime-types"));
const path_guard_1 = require("./path-guard");
const config_1 = require("../config");
class FileService {
    /**
     * List files and directories inside a given target folder
     */
    static async listFiles(relativePath = '/') {
        const { absolutePath, relativePath: cleanRelative } = (0, path_guard_1.resolveSecurePath)(relativePath);
        const stat = await fs_1.default.promises.stat(absolutePath);
        if (!stat.isDirectory()) {
            throw new Error('Specified path is a file, not a directory.');
        }
        const dirents = await fs_1.default.promises.readdir(absolutePath, { withFileTypes: true });
        const items = [];
        for (const dirent of dirents) {
            try {
                const itemAbsPath = path_1.default.join(absolutePath, dirent.name);
                // Protect against broken symlinks
                let itemStat;
                let isSymlink = dirent.isSymbolicLink();
                try {
                    itemStat = await fs_1.default.promises.stat(itemAbsPath);
                }
                catch {
                    // If stat fails (e.g. permission or broken symlink), fallback to lstat
                    itemStat = await fs_1.default.promises.lstat(itemAbsPath);
                }
                const isDir = itemStat.isDirectory();
                const ext = isDir ? '' : path_1.default.extname(dirent.name).toLowerCase();
                const mimeType = isDir ? undefined : mime_types_1.default.lookup(dirent.name) || 'application/octet-stream';
                const itemRelPath = path_1.default.join(cleanRelative, dirent.name).replace(/\\/g, '/');
                items.push({
                    name: dirent.name,
                    path: itemRelPath,
                    isDirectory: isDir,
                    size: isDir ? 0 : itemStat.size,
                    modifiedAt: itemStat.mtime.toISOString(),
                    extension: ext,
                    mimeType,
                    isSymlink,
                });
            }
            catch (err) {
                // Skip inaccessible entries without breaking entire directory view
                console.warn(`[FILES] Inaccessible item: ${dirent.name}`, err);
            }
        }
        // Sort: directories first, then alphabetically
        items.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory)
                return -1;
            if (!a.isDirectory && b.isDirectory)
                return 1;
            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });
        const parentPath = cleanRelative === '/' ? null : path_1.default.dirname(cleanRelative).replace(/\\/g, '/');
        return {
            items,
            currentPath: cleanRelative,
            parentPath: parentPath === '.' ? '/' : parentPath,
        };
    }
    /**
     * Create a new directory securely
     */
    static async createFolder(parentRelativePath, folderName) {
        const cleanName = (0, path_guard_1.sanitizeFilename)(folderName);
        if (!cleanName || cleanName === 'unnamed_file') {
            throw new Error('Invalid folder name.');
        }
        const { absolutePath: parentAbs, relativePath: parentRel } = (0, path_guard_1.resolveSecurePath)(parentRelativePath);
        const targetAbs = path_1.default.join(parentAbs, cleanName);
        // Verify target doesn't already exist
        if (fs_1.default.existsSync(targetAbs)) {
            throw new Error('Folder or file with this name already exists.');
        }
        await fs_1.default.promises.mkdir(targetAbs);
        const stat = await fs_1.default.promises.stat(targetAbs);
        const itemRelPath = path_1.default.join(parentRel, cleanName).replace(/\\/g, '/');
        return {
            name: cleanName,
            path: itemRelPath,
            isDirectory: true,
            size: 0,
            modifiedAt: stat.mtime.toISOString(),
            extension: '',
        };
    }
    /**
     * Delete an item (file or directory)
     */
    static async deleteItem(targetRelativePath) {
        const { absolutePath, relativePath } = (0, path_guard_1.resolveSecurePath)(targetRelativePath);
        if (relativePath === '/' || absolutePath === config_1.CONFIG.STORAGE_ROOT) {
            throw new Error('Cannot delete the root storage directory.');
        }
        const stat = await fs_1.default.promises.lstat(absolutePath);
        if (stat.isDirectory()) {
            await fs_1.default.promises.rm(absolutePath, { recursive: true, force: true });
        }
        else {
            await fs_1.default.promises.unlink(absolutePath);
        }
    }
    /**
     * Rename an item
     */
    static async renameItem(targetRelativePath, newName) {
        const cleanName = (0, path_guard_1.sanitizeFilename)(newName);
        if (!cleanName) {
            throw new Error('Invalid name.');
        }
        const { absolutePath, relativePath } = (0, path_guard_1.resolveSecurePath)(targetRelativePath);
        if (relativePath === '/') {
            throw new Error('Cannot rename root directory.');
        }
        const parentDir = path_1.default.dirname(absolutePath);
        const destinationAbs = path_1.default.join(parentDir, cleanName);
        // Ensure destination remains inside root
        (0, path_guard_1.resolveSecurePath)(path_1.default.join(path_1.default.dirname(relativePath), cleanName), true);
        if (fs_1.default.existsSync(destinationAbs)) {
            throw new Error('An item with the new name already exists.');
        }
        await fs_1.default.promises.rename(absolutePath, destinationAbs);
        const stat = await fs_1.default.promises.stat(destinationAbs);
        const isDir = stat.isDirectory();
        const newRelative = path_1.default.join(path_1.default.dirname(relativePath), cleanName).replace(/\\/g, '/');
        return {
            name: cleanName,
            path: newRelative,
            isDirectory: isDir,
            size: isDir ? 0 : stat.size,
            modifiedAt: stat.mtime.toISOString(),
            extension: isDir ? '' : path_1.default.extname(cleanName).toLowerCase(),
            mimeType: isDir ? undefined : mime_types_1.default.lookup(cleanName) || 'application/octet-stream',
        };
    }
    /**
     * Move an item to a destination folder
     */
    static async moveItem(sourceRelativePath, destinationFolderRelativePath) {
        const { absolutePath: srcAbs, relativePath: srcRel } = (0, path_guard_1.resolveSecurePath)(sourceRelativePath);
        const { absolutePath: destFolderAbs } = (0, path_guard_1.resolveSecurePath)(destinationFolderRelativePath);
        const destStat = await fs_1.default.promises.stat(destFolderAbs);
        if (!destStat.isDirectory()) {
            throw new Error('Destination must be a directory.');
        }
        const baseName = path_1.default.basename(srcAbs);
        const destAbs = path_1.default.join(destFolderAbs, baseName);
        // Prevent moving folder into itself
        if (destAbs.startsWith(srcAbs + path_1.default.sep)) {
            throw new Error('Cannot move a folder into itself.');
        }
        if (fs_1.default.existsSync(destAbs)) {
            throw new Error('An item with the same name already exists in destination.');
        }
        await fs_1.default.promises.rename(srcAbs, destAbs);
    }
    /**
     * Copy an item to a destination folder
     */
    static async copyItem(sourceRelativePath, destinationFolderRelativePath) {
        const { absolutePath: srcAbs } = (0, path_guard_1.resolveSecurePath)(sourceRelativePath);
        const { absolutePath: destFolderAbs } = (0, path_guard_1.resolveSecurePath)(destinationFolderRelativePath);
        const destStat = await fs_1.default.promises.stat(destFolderAbs);
        if (!destStat.isDirectory()) {
            throw new Error('Destination must be a directory.');
        }
        const baseName = path_1.default.basename(srcAbs);
        const destAbs = path_1.default.join(destFolderAbs, baseName);
        if (fs_1.default.existsSync(destAbs)) {
            throw new Error('An item with the same name already exists in destination.');
        }
        await fs_1.default.promises.cp(srcAbs, destAbs, { recursive: true });
    }
    /**
     * Get filesystem level storage statistics (without traversing 128GB)
     */
    static async getStorageUsage() {
        try {
            if (typeof fs_1.default.statfsSync === 'function') {
                const stats = fs_1.default.statfsSync(config_1.CONFIG.STORAGE_ROOT);
                const totalBytes = stats.bsize * stats.blocks;
                const freeBytes = stats.bsize * stats.bfree;
                const usedBytes = totalBytes - freeBytes;
                const usedPercentage = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;
                return {
                    totalBytes,
                    usedBytes,
                    freeBytes,
                    usedPercentage,
                    mountPoint: config_1.CONFIG.STORAGE_ROOT,
                };
            }
        }
        catch (err) {
            console.warn('[FILES] statfsSync failed, falling back to basic metrics:', err);
        }
        // Default fallback for development when statfs is not supported on host OS volume
        return {
            totalBytes: 128 * 1024 * 1024 * 1024, // 128 GB target OPPO phone storage
            usedBytes: 42 * 1024 * 1024 * 1024,
            freeBytes: 86 * 1024 * 1024 * 1024,
            usedPercentage: 33,
            mountPoint: config_1.CONFIG.STORAGE_ROOT,
        };
    }
}
exports.FileService = FileService;
