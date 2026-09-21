"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PathTraversalError = void 0;
exports.resolveSecurePath = resolveSecurePath;
exports.sanitizeFilename = sanitizeFilename;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const config_1 = require("../config");
class PathTraversalError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PathTraversalError';
    }
}
exports.PathTraversalError = PathTraversalError;
/**
 * Resolves and validates that any user-supplied path strictly resides within CONFIG.STORAGE_ROOT.
 *
 * Enforces:
 * 1. Null-byte rejection
 * 2. URI decoding & recursive traversal pattern checks
 * 3. Canonical path resolution
 * 4. Boundary verification (startsWith root + path separator)
 * 5. Symlink escape detection via realpath
 */
function resolveSecurePath(userPath = '', allowNonExistent = false) {
    // 1. Check for null bytes or control characters
    if (userPath.includes('\0') || /[\x00-\x1f\x7f]/.test(userPath)) {
        throw new PathTraversalError('Invalid path: null bytes or control characters detected.');
    }
    // 2. Decode percent-encoded components safely
    let decoded = userPath;
    try {
        decoded = decodeURIComponent(userPath);
    }
    catch {
        throw new PathTraversalError('Invalid path: malformed URL encoding.');
    }
    // 3. Reject drive letters or absolute system root breakout attempts
    if (/^[a-zA-Z]:/.test(decoded) || /^(\/|\\)(etc|data|proc|sys|system|bin|sbin|dev|usr|var|root)/i.test(decoded)) {
        throw new PathTraversalError('Access denied: System root path specified.');
    }
    // 4. Normalize slashes
    const sanitizedInput = decoded.replace(/\\/g, '/').replace(/^\/+/, '');
    // 4. Resolve absolute path relative to STORAGE_ROOT
    const rootAbsolute = path_1.default.resolve(config_1.CONFIG.STORAGE_ROOT);
    const candidateAbsolute = path_1.default.resolve(rootAbsolute, sanitizedInput);
    // 5. Verify the candidate begins with the canonical root
    const rootWithSep = rootAbsolute.endsWith(path_1.default.sep) ? rootAbsolute : rootAbsolute + path_1.default.sep;
    // Exact root match is allowed
    if (candidateAbsolute !== rootAbsolute && !candidateAbsolute.startsWith(rootWithSep)) {
        throw new PathTraversalError('Access denied: Path traversal outside allowed storage root.');
    }
    // 6. Check existing file/folder symlink escape
    if (fs_1.default.existsSync(candidateAbsolute)) {
        try {
            const realCandidate = fs_1.default.realpathSync(candidateAbsolute);
            const realRoot = fs_1.default.realpathSync(rootAbsolute);
            const realRootWithSep = realRoot.endsWith(path_1.default.sep) ? realRoot : realRoot + path_1.default.sep;
            if (realCandidate !== realRoot && !realCandidate.startsWith(realRootWithSep)) {
                throw new PathTraversalError('Access denied: Symlink target resolves outside allowed storage root.');
            }
        }
        catch {
            throw new PathTraversalError('Access denied: Unable to verify path canonical target.');
        }
    }
    else if (!allowNonExistent) {
        throw new PathTraversalError('Path not found.');
    }
    // Calculate clean relative path for clients
    const relative = path_1.default.relative(rootAbsolute, candidateAbsolute).replace(/\\/g, '/');
    return {
        absolutePath: candidateAbsolute,
        relativePath: relative === '' ? '/' : `/${relative}`,
    };
}
/**
 * Sanitizes a filename for file upload or creation, removing illegal characters and path separators.
 */
function sanitizeFilename(filename) {
    if (!filename)
        return 'unnamed_file';
    // Strip path traversal attempts and directory separators
    const base = path_1.default.basename(filename);
    const clean = base
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
        .replace(/^\.+/, '') // No hidden or dot-dot files
        .trim();
    return clean.length > 0 ? clean.substring(0, 255) : 'unnamed_file';
}
