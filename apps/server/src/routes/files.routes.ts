import { Router } from 'express';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { requirePermission } from '../security/rbac-middleware';
import { PERMISSIONS } from '@android-server/shared';
import { FileService } from '../files/file-service';
import { resolveSecurePath } from '../files/path-guard';
import { uploadMiddleware, finalizeUploads } from '../files/upload-middleware';
import { logAudit } from '../audit/audit-service';

export const filesRouter = Router();

// GET /api/files/list
filesRouter.get('/list', requirePermission(PERMISSIONS.FILES_READ), async (req, res) => {
  try {
    const targetPath = (req.query.path as string) || '/';
    const result = await FileService.listFiles(targetPath);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/files/create-folder
const createFolderSchema = z.object({
  parentPath: z.string().default('/'),
  name: z.string().min(1).max(255),
});

filesRouter.post('/create-folder', requirePermission(PERMISSIONS.FILES_WRITE), async (req, res) => {
  try {
    const { parentPath, name } = createFolderSchema.parse(req.body);
    const item = await FileService.createFolder(parentPath, name);

    await logAudit({
      userId: req.user?.id,
      username: req.user?.username || 'user',
      action: 'FILE_CREATE',
      target: item.path,
      status: 'SUCCESS',
      ipAddress: req.ip || '',
      details: { type: 'directory' },
    });

    res.json({ message: 'Folder created.', item });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/files/upload
filesRouter.post(
  '/upload',
  requirePermission(PERMISSIONS.FILES_UPLOAD),
  uploadMiddleware.array('files'),
  async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded.' });
      }

      const targetPath = (req.body.targetPath as string) || '/';
      const uploaded = await finalizeUploads(files, targetPath);

      for (const f of uploaded) {
        await logAudit({
          userId: req.user?.id,
          username: req.user?.username || 'user',
          action: 'FILE_UPLOAD',
          target: f.path,
          status: 'SUCCESS',
          ipAddress: req.ip || '',
          details: { sizeBytes: f.size },
        });
      }

      res.json({ message: 'Files uploaded successfully.', files: uploaded });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

// GET /api/files/download
filesRouter.get('/download', requirePermission(PERMISSIONS.FILES_DOWNLOAD), async (req, res) => {
  try {
    const targetPath = req.query.path as string;
    if (!targetPath) {
      return res.status(400).json({ error: 'Path is required.' });
    }

    const { absolutePath, relativePath } = resolveSecurePath(targetPath);
    const stat = await fs.promises.stat(absolutePath);

    if (stat.isDirectory()) {
      return res.status(400).json({ error: 'Cannot download a folder directly.' });
    }

    await logAudit({
      userId: req.user?.id,
      username: req.user?.username || 'user',
      action: 'FILE_DOWNLOAD',
      target: relativePath,
      status: 'SUCCESS',
      ipAddress: req.ip || '',
    });

    res.download(absolutePath, path.basename(absolutePath));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/files/delete
const deleteSchema = z.object({
  path: z.string(),
});

filesRouter.delete('/delete', requirePermission(PERMISSIONS.FILES_DELETE), async (req, res) => {
  try {
    const { path: targetPath } = deleteSchema.parse(req.body);
    await FileService.deleteItem(targetPath);

    await logAudit({
      userId: req.user?.id,
      username: req.user?.username || 'user',
      action: 'FILE_DELETE',
      target: targetPath,
      status: 'SUCCESS',
      ipAddress: req.ip || '',
    });

    res.json({ message: 'Item deleted successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/files/rename
const renameSchema = z.object({
  path: z.string(),
  newName: z.string().min(1).max(255),
});

filesRouter.post('/rename', requirePermission(PERMISSIONS.FILES_RENAME), async (req, res) => {
  try {
    const { path: targetPath, newName } = renameSchema.parse(req.body);
    const updated = await FileService.renameItem(targetPath, newName);

    await logAudit({
      userId: req.user?.id,
      username: req.user?.username || 'user',
      action: 'FILE_RENAME',
      target: `${targetPath} -> ${updated.path}`,
      status: 'SUCCESS',
      ipAddress: req.ip || '',
    });

    res.json({ message: 'Item renamed.', item: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/files/move
const moveSchema = z.object({
  sourcePath: z.string(),
  destinationFolder: z.string(),
});

filesRouter.post('/move', requirePermission(PERMISSIONS.FILES_MOVE), async (req, res) => {
  try {
    const { sourcePath, destinationFolder } = moveSchema.parse(req.body);
    await FileService.moveItem(sourcePath, destinationFolder);

    await logAudit({
      userId: req.user?.id,
      username: req.user?.username || 'user',
      action: 'FILE_MOVE',
      target: `${sourcePath} -> ${destinationFolder}`,
      status: 'SUCCESS',
      ipAddress: req.ip || '',
    });

    res.json({ message: 'Item moved successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/files/copy
filesRouter.post('/copy', requirePermission(PERMISSIONS.FILES_WRITE), async (req, res) => {
  try {
    const { sourcePath, destinationFolder } = moveSchema.parse(req.body);
    await FileService.copyItem(sourcePath, destinationFolder);

    await logAudit({
      userId: req.user?.id,
      username: req.user?.username || 'user',
      action: 'FILE_COPY',
      target: `${sourcePath} -> ${destinationFolder}`,
      status: 'SUCCESS',
      ipAddress: req.ip || '',
    });

    res.json({ message: 'Item copied successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/files/storage-stats
filesRouter.get('/storage-stats', requirePermission(PERMISSIONS.FILES_READ), async (req, res) => {
  try {
    const stats = await FileService.getStorageUsage();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
