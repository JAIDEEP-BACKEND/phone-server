"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.filesRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const rbac_middleware_1 = require("../security/rbac-middleware");
const shared_1 = require("@android-server/shared");
const file_service_1 = require("../files/file-service");
const path_guard_1 = require("../files/path-guard");
const upload_middleware_1 = require("../files/upload-middleware");
const audit_service_1 = require("../audit/audit-service");
exports.filesRouter = (0, express_1.Router)();
// GET /api/files/list
exports.filesRouter.get('/list', (0, rbac_middleware_1.requirePermission)(shared_1.PERMISSIONS.FILES_READ), async (req, res) => {
    try {
        const targetPath = req.query.path || '/';
        const result = await file_service_1.FileService.listFiles(targetPath);
        res.json(result);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// POST /api/files/create-folder
const createFolderSchema = zod_1.z.object({
    parentPath: zod_1.z.string().default('/'),
    name: zod_1.z.string().min(1).max(255),
});
exports.filesRouter.post('/create-folder', (0, rbac_middleware_1.requirePermission)(shared_1.PERMISSIONS.FILES_WRITE), async (req, res) => {
    try {
        const { parentPath, name } = createFolderSchema.parse(req.body);
        const item = await file_service_1.FileService.createFolder(parentPath, name);
        await (0, audit_service_1.logAudit)({
            userId: req.user?.id,
            username: req.user?.username || 'user',
            action: 'FILE_CREATE',
            target: item.path,
            status: 'SUCCESS',
            ipAddress: req.ip || '',
            details: { type: 'directory' },
        });
        res.json({ message: 'Folder created.', item });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// POST /api/files/upload
exports.filesRouter.post('/upload', (0, rbac_middleware_1.requirePermission)(shared_1.PERMISSIONS.FILES_UPLOAD), upload_middleware_1.uploadMiddleware.array('files'), async (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded.' });
        }
        const targetPath = req.body.targetPath || '/';
        const uploaded = await (0, upload_middleware_1.finalizeUploads)(files, targetPath);
        for (const f of uploaded) {
            await (0, audit_service_1.logAudit)({
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
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// GET /api/files/download
exports.filesRouter.get('/download', (0, rbac_middleware_1.requirePermission)(shared_1.PERMISSIONS.FILES_DOWNLOAD), async (req, res) => {
    try {
        const targetPath = req.query.path;
        if (!targetPath) {
            return res.status(400).json({ error: 'Path is required.' });
        }
        const { absolutePath, relativePath } = (0, path_guard_1.resolveSecurePath)(targetPath);
        const stat = await fs_1.default.promises.stat(absolutePath);
        if (stat.isDirectory()) {
            return res.status(400).json({ error: 'Cannot download a folder directly.' });
        }
        await (0, audit_service_1.logAudit)({
            userId: req.user?.id,
            username: req.user?.username || 'user',
            action: 'FILE_DOWNLOAD',
            target: relativePath,
            status: 'SUCCESS',
            ipAddress: req.ip || '',
        });
        res.download(absolutePath, path_1.default.basename(absolutePath));
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// DELETE /api/files/delete
const deleteSchema = zod_1.z.object({
    path: zod_1.z.string(),
});
exports.filesRouter.delete('/delete', (0, rbac_middleware_1.requirePermission)(shared_1.PERMISSIONS.FILES_DELETE), async (req, res) => {
    try {
        const { path: targetPath } = deleteSchema.parse(req.body);
        await file_service_1.FileService.deleteItem(targetPath);
        await (0, audit_service_1.logAudit)({
            userId: req.user?.id,
            username: req.user?.username || 'user',
            action: 'FILE_DELETE',
            target: targetPath,
            status: 'SUCCESS',
            ipAddress: req.ip || '',
        });
        res.json({ message: 'Item deleted successfully.' });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// POST /api/files/rename
const renameSchema = zod_1.z.object({
    path: zod_1.z.string(),
    newName: zod_1.z.string().min(1).max(255),
});
exports.filesRouter.post('/rename', (0, rbac_middleware_1.requirePermission)(shared_1.PERMISSIONS.FILES_RENAME), async (req, res) => {
    try {
        const { path: targetPath, newName } = renameSchema.parse(req.body);
        const updated = await file_service_1.FileService.renameItem(targetPath, newName);
        await (0, audit_service_1.logAudit)({
            userId: req.user?.id,
            username: req.user?.username || 'user',
            action: 'FILE_RENAME',
            target: `${targetPath} -> ${updated.path}`,
            status: 'SUCCESS',
            ipAddress: req.ip || '',
        });
        res.json({ message: 'Item renamed.', item: updated });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// POST /api/files/move
const moveSchema = zod_1.z.object({
    sourcePath: zod_1.z.string(),
    destinationFolder: zod_1.z.string(),
});
exports.filesRouter.post('/move', (0, rbac_middleware_1.requirePermission)(shared_1.PERMISSIONS.FILES_MOVE), async (req, res) => {
    try {
        const { sourcePath, destinationFolder } = moveSchema.parse(req.body);
        await file_service_1.FileService.moveItem(sourcePath, destinationFolder);
        await (0, audit_service_1.logAudit)({
            userId: req.user?.id,
            username: req.user?.username || 'user',
            action: 'FILE_MOVE',
            target: `${sourcePath} -> ${destinationFolder}`,
            status: 'SUCCESS',
            ipAddress: req.ip || '',
        });
        res.json({ message: 'Item moved successfully.' });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// POST /api/files/copy
exports.filesRouter.post('/copy', (0, rbac_middleware_1.requirePermission)(shared_1.PERMISSIONS.FILES_WRITE), async (req, res) => {
    try {
        const { sourcePath, destinationFolder } = moveSchema.parse(req.body);
        await file_service_1.FileService.copyItem(sourcePath, destinationFolder);
        await (0, audit_service_1.logAudit)({
            userId: req.user?.id,
            username: req.user?.username || 'user',
            action: 'FILE_COPY',
            target: `${sourcePath} -> ${destinationFolder}`,
            status: 'SUCCESS',
            ipAddress: req.ip || '',
        });
        res.json({ message: 'Item copied successfully.' });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// GET /api/files/storage-stats
exports.filesRouter.get('/storage-stats', (0, rbac_middleware_1.requirePermission)(shared_1.PERMISSIONS.FILES_READ), async (req, res) => {
    try {
        const stats = await file_service_1.FileService.getStorageUsage();
        res.json(stats);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
