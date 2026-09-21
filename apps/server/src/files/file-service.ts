import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import { FileItem, StorageStats } from '@android-server/shared';
import { resolveSecurePath, sanitizeFilename, PathTraversalError } from './path-guard';
import { CONFIG } from '../config';

export class FileService {
  /**
   * List files and directories inside a given target folder
   */
  static async listFiles(relativePath: string = '/'): Promise<{
    items: FileItem[];
    currentPath: string;
    parentPath: string | null;
  }> {
    const { absolutePath, relativePath: cleanRelative } = resolveSecurePath(relativePath);

    const stat = await fs.promises.stat(absolutePath);
    if (!stat.isDirectory()) {
      throw new Error('Specified path is a file, not a directory.');
    }

    const dirents = await fs.promises.readdir(absolutePath, { withFileTypes: true });
    const items: FileItem[] = [];

    for (const dirent of dirents) {
      try {
        const itemAbsPath = path.join(absolutePath, dirent.name);
        // Protect against broken symlinks
        let itemStat: fs.Stats;
        let isSymlink = dirent.isSymbolicLink();

        try {
          itemStat = await fs.promises.stat(itemAbsPath);
        } catch {
          // If stat fails (e.g. permission or broken symlink), fallback to lstat
          itemStat = await fs.promises.lstat(itemAbsPath);
        }

        const isDir = itemStat.isDirectory();
        const ext = isDir ? '' : path.extname(dirent.name).toLowerCase();
        const mimeType = isDir ? undefined : mime.lookup(dirent.name) || 'application/octet-stream';
        const itemRelPath = path.join(cleanRelative, dirent.name).replace(/\\/g, '/');

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
      } catch (err) {
        // Skip inaccessible entries without breaking entire directory view
        console.warn(`[FILES] Inaccessible item: ${dirent.name}`, err);
      }
    }

    // Sort: directories first, then alphabetically
    items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    const parentPath = cleanRelative === '/' ? null : path.dirname(cleanRelative).replace(/\\/g, '/');

    return {
      items,
      currentPath: cleanRelative,
      parentPath: parentPath === '.' ? '/' : parentPath,
    };
  }

  /**
   * Create a new directory securely
   */
  static async createFolder(parentRelativePath: string, folderName: string): Promise<FileItem> {
    const cleanName = sanitizeFilename(folderName);
    if (!cleanName || cleanName === 'unnamed_file') {
      throw new Error('Invalid folder name.');
    }

    const { absolutePath: parentAbs, relativePath: parentRel } = resolveSecurePath(parentRelativePath);
    const targetAbs = path.join(parentAbs, cleanName);

    // Verify target doesn't already exist
    if (fs.existsSync(targetAbs)) {
      throw new Error('Folder or file with this name already exists.');
    }

    await fs.promises.mkdir(targetAbs);
    const stat = await fs.promises.stat(targetAbs);
    const itemRelPath = path.join(parentRel, cleanName).replace(/\\/g, '/');

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
  static async deleteItem(targetRelativePath: string): Promise<void> {
    const { absolutePath, relativePath } = resolveSecurePath(targetRelativePath);

    if (relativePath === '/' || absolutePath === CONFIG.STORAGE_ROOT) {
      throw new Error('Cannot delete the root storage directory.');
    }

    const stat = await fs.promises.lstat(absolutePath);
    if (stat.isDirectory()) {
      await fs.promises.rm(absolutePath, { recursive: true, force: true });
    } else {
      await fs.promises.unlink(absolutePath);
    }
  }

  /**
   * Rename an item
   */
  static async renameItem(targetRelativePath: string, newName: string): Promise<FileItem> {
    const cleanName = sanitizeFilename(newName);
    if (!cleanName) {
      throw new Error('Invalid name.');
    }

    const { absolutePath, relativePath } = resolveSecurePath(targetRelativePath);
    if (relativePath === '/') {
      throw new Error('Cannot rename root directory.');
    }

    const parentDir = path.dirname(absolutePath);
    const destinationAbs = path.join(parentDir, cleanName);

    // Ensure destination remains inside root
    resolveSecurePath(path.join(path.dirname(relativePath), cleanName), true);

    if (fs.existsSync(destinationAbs)) {
      throw new Error('An item with the new name already exists.');
    }

    await fs.promises.rename(absolutePath, destinationAbs);
    const stat = await fs.promises.stat(destinationAbs);
    const isDir = stat.isDirectory();
    const newRelative = path.join(path.dirname(relativePath), cleanName).replace(/\\/g, '/');

    return {
      name: cleanName,
      path: newRelative,
      isDirectory: isDir,
      size: isDir ? 0 : stat.size,
      modifiedAt: stat.mtime.toISOString(),
      extension: isDir ? '' : path.extname(cleanName).toLowerCase(),
      mimeType: isDir ? undefined : mime.lookup(cleanName) || 'application/octet-stream',
    };
  }

  /**
   * Move an item to a destination folder
   */
  static async moveItem(sourceRelativePath: string, destinationFolderRelativePath: string): Promise<void> {
    const { absolutePath: srcAbs, relativePath: srcRel } = resolveSecurePath(sourceRelativePath);
    const { absolutePath: destFolderAbs } = resolveSecurePath(destinationFolderRelativePath);

    const destStat = await fs.promises.stat(destFolderAbs);
    if (!destStat.isDirectory()) {
      throw new Error('Destination must be a directory.');
    }

    const baseName = path.basename(srcAbs);
    const destAbs = path.join(destFolderAbs, baseName);

    // Prevent moving folder into itself
    if (destAbs.startsWith(srcAbs + path.sep)) {
      throw new Error('Cannot move a folder into itself.');
    }

    if (fs.existsSync(destAbs)) {
      throw new Error('An item with the same name already exists in destination.');
    }

    await fs.promises.rename(srcAbs, destAbs);
  }

  /**
   * Copy an item to a destination folder
   */
  static async copyItem(sourceRelativePath: string, destinationFolderRelativePath: string): Promise<void> {
    const { absolutePath: srcAbs } = resolveSecurePath(sourceRelativePath);
    const { absolutePath: destFolderAbs } = resolveSecurePath(destinationFolderRelativePath);

    const destStat = await fs.promises.stat(destFolderAbs);
    if (!destStat.isDirectory()) {
      throw new Error('Destination must be a directory.');
    }

    const baseName = path.basename(srcAbs);
    const destAbs = path.join(destFolderAbs, baseName);

    if (fs.existsSync(destAbs)) {
      throw new Error('An item with the same name already exists in destination.');
    }

    await fs.promises.cp(srcAbs, destAbs, { recursive: true });
  }

  /**
   * Get filesystem level storage statistics (without traversing 128GB)
   */
  static async getStorageUsage(): Promise<StorageStats> {
    try {
      if (typeof fs.statfsSync === 'function') {
        const stats = fs.statfsSync(CONFIG.STORAGE_ROOT);
        const totalBytes = stats.bsize * stats.blocks;
        const freeBytes = stats.bsize * stats.bfree;
        const usedBytes = totalBytes - freeBytes;
        const usedPercentage = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;

        return {
          totalBytes,
          usedBytes,
          freeBytes,
          usedPercentage,
          mountPoint: CONFIG.STORAGE_ROOT,
        };
      }
    } catch (err) {
      console.warn('[FILES] statfsSync failed, falling back to basic metrics:', err);
    }

    // Default fallback for development when statfs is not supported on host OS volume
    return {
      totalBytes: 128 * 1024 * 1024 * 1024, // 128 GB target OPPO phone storage
      usedBytes: 42 * 1024 * 1024 * 1024,
      freeBytes: 86 * 1024 * 1024 * 1024,
      usedPercentage: 33,
      mountPoint: CONFIG.STORAGE_ROOT,
    };
  }
}
