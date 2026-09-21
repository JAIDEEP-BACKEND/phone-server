"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadMiddleware = void 0;
exports.finalizeUploads = finalizeUploads;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const config_1 = require("../config");
const path_guard_1 = require("./path-guard");
const fs_utils_1 = require("./fs-utils");
function getUploadTempDir() {
    // Prefer storing temporary uploads directly on the target storage disk
    // so final placement is an instant same-device rename
    const preferredDir = path_1.default.join(config_1.CONFIG.STORAGE_ROOT, '.nas_temp_uploads');
    try {
        if (!fs_1.default.existsSync(preferredDir)) {
            fs_1.default.mkdirSync(preferredDir, { recursive: true });
        }
        return preferredDir;
    }
    catch {
        const osFallback = path_1.default.join(os_1.default.tmpdir(), 'nas-uploads-temp');
        if (!fs_1.default.existsSync(osFallback)) {
            fs_1.default.mkdirSync(osFallback, { recursive: true });
        }
        return osFallback;
    }
}
// Multer temporary storage configuration
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, getUploadTempDir());
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        cb(null, `upload_${uniqueSuffix}.tmp`);
    },
});
exports.uploadMiddleware = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: config_1.CONFIG.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
        files: 50, // Max 50 files per bulk upload request
    },
});
/**
 * Moves uploaded files from temp directory to the validated target storage directory
 */
async function finalizeUploads(files, targetRelativeDir) {
    const { absolutePath: destFolderAbs, relativePath: destFolderRel } = (0, path_guard_1.resolveSecurePath)(targetRelativeDir);
    const results = [];
    for (const file of files) {
        const cleanName = (0, path_guard_1.sanitizeFilename)(file.originalname);
        let finalTargetAbs = path_1.default.join(destFolderAbs, cleanName);
        // If file already exists, create duplicate with counter
        let counter = 1;
        const ext = path_1.default.extname(cleanName);
        const baseWithoutExt = path_1.default.basename(cleanName, ext);
        while (fs_1.default.existsSync(finalTargetAbs)) {
            const numberedName = `${baseWithoutExt} (${counter})${ext}`;
            finalTargetAbs = path_1.default.join(destFolderAbs, numberedName);
            counter++;
        }
        // Move file safely across devices/filesystems
        await (0, fs_utils_1.movePathSafely)(file.path, finalTargetAbs);
        const savedName = path_1.default.basename(finalTargetAbs);
        results.push({
            originalName: file.originalname,
            savedName,
            size: file.size,
            path: path_1.default.join(destFolderRel, savedName).replace(/\\/g, '/'),
        });
    }
    return results;
}
