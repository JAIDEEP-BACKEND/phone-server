import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { CONFIG } from '../config';
import { resolveSecurePath, sanitizeFilename } from './path-guard';
import { movePathSafely } from './fs-utils';

function getUploadTempDir(): string {
  // Prefer storing temporary uploads directly on the target storage disk
  // so final placement is an instant same-device rename
  const preferredDir = path.join(CONFIG.STORAGE_ROOT, '.nas_temp_uploads');
  try {
    if (!fs.existsSync(preferredDir)) {
      fs.mkdirSync(preferredDir, { recursive: true });
    }
    return preferredDir;
  } catch {
    const osFallback = path.join(os.tmpdir(), 'nas-uploads-temp');
    if (!fs.existsSync(osFallback)) {
      fs.mkdirSync(osFallback, { recursive: true });
    }
    return osFallback;
  }
}

// Multer temporary storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, getUploadTempDir());
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    cb(null, `upload_${uniqueSuffix}.tmp`);
  },
});

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: CONFIG.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
    files: 50, // Max 50 files per bulk upload request
  },
});

/**
 * Moves uploaded files from temp directory to the validated target storage directory
 */
export async function finalizeUploads(
  files: Express.Multer.File[],
  targetRelativeDir: string
): Promise<{ originalName: string; savedName: string; size: number; path: string }[]> {
  const { absolutePath: destFolderAbs, relativePath: destFolderRel } = resolveSecurePath(targetRelativeDir);

  const results = [];

  for (const file of files) {
    const cleanName = sanitizeFilename(file.originalname);
    let finalTargetAbs = path.join(destFolderAbs, cleanName);

    // If file already exists, create duplicate with counter
    let counter = 1;
    const ext = path.extname(cleanName);
    const baseWithoutExt = path.basename(cleanName, ext);

    while (fs.existsSync(finalTargetAbs)) {
      const numberedName = `${baseWithoutExt} (${counter})${ext}`;
      finalTargetAbs = path.join(destFolderAbs, numberedName);
      counter++;
    }

    // Move file safely across devices/filesystems
    await movePathSafely(file.path, finalTargetAbs);
    const savedName = path.basename(finalTargetAbs);

    results.push({
      originalName: file.originalname,
      savedName,
      size: file.size,
      path: path.join(destFolderRel, savedName).replace(/\\/g, '/'),
    });
  }

  return results;
}

