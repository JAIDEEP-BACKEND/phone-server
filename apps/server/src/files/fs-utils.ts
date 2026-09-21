import fs from 'fs';

/**
 * Moves a file or directory across filesystems safely.
 *
 * When moving between different mount points (e.g. /data/data/com.termux and /storage/emulated/0),
 * Linux returns EXDEV ("cross-device link not permitted").
 * This helper attempts an atomic rename first, and automatically falls back to copy+delete.
 */
export async function movePathSafely(sourcePath: string, targetPath: string): Promise<void> {
  try {
    await fs.promises.rename(sourcePath, targetPath);
  } catch (err: any) {
    if (err.code === 'EXDEV' || err.code === 'EPERM' || err.code === 'EACCES') {
      const stat = await fs.promises.stat(sourcePath);
      if (stat.isDirectory()) {
        await fs.promises.cp(sourcePath, targetPath, { recursive: true });
        await fs.promises.rm(sourcePath, { recursive: true, force: true });
      } else {
        await fs.promises.copyFile(sourcePath, targetPath);
        await fs.promises.unlink(sourcePath);
      }
    } else {
      throw err;
    }
  }
}
