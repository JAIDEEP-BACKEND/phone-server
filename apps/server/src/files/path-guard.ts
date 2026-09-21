import path from 'path';
import fs from 'fs';
import { CONFIG } from '../config';

export class PathTraversalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PathTraversalError';
  }
}

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
export function resolveSecurePath(userPath: string = '', allowNonExistent = false): {
  absolutePath: string;
  relativePath: string;
} {
  // 1. Check for null bytes or control characters
  if (userPath.includes('\0') || /[\x00-\x1f\x7f]/.test(userPath)) {
    throw new PathTraversalError('Invalid path: null bytes or control characters detected.');
  }

  // 2. Decode percent-encoded components safely
  let decoded = userPath;
  try {
    decoded = decodeURIComponent(userPath);
  } catch {
    throw new PathTraversalError('Invalid path: malformed URL encoding.');
  }

  // 3. Reject drive letters or absolute system root breakout attempts
  if (/^[a-zA-Z]:/.test(decoded) || /^(\/|\\)(etc|data|proc|sys|system|bin|sbin|dev|usr|var|root)/i.test(decoded)) {
    throw new PathTraversalError('Access denied: System root path specified.');
  }

  // 4. Normalize slashes
  const sanitizedInput = decoded.replace(/\\/g, '/').replace(/^\/+/, '');

  // 4. Resolve absolute path relative to STORAGE_ROOT
  const rootAbsolute = path.resolve(CONFIG.STORAGE_ROOT);
  const candidateAbsolute = path.resolve(rootAbsolute, sanitizedInput);

  // 5. Verify the candidate begins with the canonical root
  const rootWithSep = rootAbsolute.endsWith(path.sep) ? rootAbsolute : rootAbsolute + path.sep;

  // Exact root match is allowed
  if (candidateAbsolute !== rootAbsolute && !candidateAbsolute.startsWith(rootWithSep)) {
    throw new PathTraversalError('Access denied: Path traversal outside allowed storage root.');
  }

  // 6. Check existing file/folder symlink escape
  if (fs.existsSync(candidateAbsolute)) {
    try {
      const realCandidate = fs.realpathSync(candidateAbsolute);
      const realRoot = fs.realpathSync(rootAbsolute);
      const realRootWithSep = realRoot.endsWith(path.sep) ? realRoot : realRoot + path.sep;

      if (realCandidate !== realRoot && !realCandidate.startsWith(realRootWithSep)) {
        throw new PathTraversalError('Access denied: Symlink target resolves outside allowed storage root.');
      }
    } catch {
      throw new PathTraversalError('Access denied: Unable to verify path canonical target.');
    }
  } else if (!allowNonExistent) {
    throw new PathTraversalError('Path not found.');
  }

  // Calculate clean relative path for clients
  const relative = path.relative(rootAbsolute, candidateAbsolute).replace(/\\/g, '/');

  return {
    absolutePath: candidateAbsolute,
    relativePath: relative === '' ? '/' : `/${relative}`,
  };
}

/**
 * Sanitizes a filename for file upload or creation, removing illegal characters and path separators.
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return 'unnamed_file';

  // Strip path traversal attempts and directory separators
  const base = path.basename(filename);
  const clean = base
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/^\.+/, '') // No hidden or dot-dot files
    .trim();

  return clean.length > 0 ? clean.substring(0, 255) : 'unnamed_file';
}
