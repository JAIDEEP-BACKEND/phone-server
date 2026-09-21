const assert = require('assert');
const path = require('path');
const fs = require('fs');

const rootPath = path.resolve(__dirname, '../storage');
if (!fs.existsSync(rootPath)) {
  fs.mkdirSync(rootPath, { recursive: true });
}

function resolveSecurePath(userPath = '', storageRoot = rootPath) {
  if (userPath.includes('\0') || /[\x00-\x1f\x7f]/.test(userPath)) {
    throw new Error('PathTraversalError: null bytes detected.');
  }

  let decoded = userPath;
  try {
    decoded = decodeURIComponent(userPath);
  } catch {
    throw new Error('PathTraversalError: malformed encoding.');
  }

  if (/^[a-zA-Z]:/.test(decoded) || /^(\/|\\)(etc|data|proc|sys|system|bin|sbin|dev|usr|var|root)/i.test(decoded)) {
    throw new Error('PathTraversalError: system root path specified.');
  }

  const sanitizedInput = decoded.replace(/\\/g, '/').replace(/^\/+/, '');
  const candidateAbsolute = path.resolve(storageRoot, sanitizedInput);
  const rootWithSep = storageRoot.endsWith(path.sep) ? storageRoot : storageRoot + path.sep;

  if (candidateAbsolute !== storageRoot && !candidateAbsolute.startsWith(rootWithSep)) {
    throw new Error('PathTraversalError: escape detected.');
  }

  return candidateAbsolute;
}

console.log('--- RUNNING SECURITY PATH TRAVERSAL TESTS ---');

const maliciousPaths = [
  '../',
  '../../',
  '../../../../etc/passwd',
  '..\\..\\windows\\system32',
  '%2e%2e%2f%2e%2e%2f',
  'documents/../../../secret.txt',
  'test\0.txt',
  '/etc/shadow',
  '/data/data/com.termux/files/home',
  'C:\\Windows\\System32',
];

let blockedCount = 0;
for (const p of maliciousPaths) {
  try {
    resolveSecurePath(p);
    console.error(`[FAIL] Malicious path was NOT blocked: ${p}`);
    process.exit(1);
  } catch (err) {
    blockedCount++;
    console.log(`[PASS] Blocked attack vector: ${p} -> ${err.message}`);
  }
}

assert.strictEqual(blockedCount, maliciousPaths.length);

// Verify valid paths inside storage root
const validPath = resolveSecurePath('photos/vacation.jpg');
assert.strictEqual(validPath, path.join(rootPath, 'photos', 'vacation.jpg'));
console.log(`[PASS] Legitimate nested path accepted: ${validPath}`);

console.log('--- ALL SECURITY TESTS PASSED SUCCESSFULLY ---');
