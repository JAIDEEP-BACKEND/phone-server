"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_DEFAULT_PERMISSIONS = exports.ALL_PERMISSIONS = exports.PERMISSIONS = void 0;
exports.PERMISSIONS = {
    // File operations
    FILES_READ: 'files.read',
    FILES_WRITE: 'files.write',
    FILES_UPLOAD: 'files.upload',
    FILES_DOWNLOAD: 'files.download',
    FILES_DELETE: 'files.delete',
    FILES_RENAME: 'files.rename',
    FILES_MOVE: 'files.move',
    // Terminal
    SHELL_ACCESS: 'shell.access',
    // System
    SYSTEM_VIEW: 'system.view',
    SYSTEM_POWER: 'system.power',
    // Remote screen & control
    SCREEN_VIEW: 'screen.view',
    PHONE_CONTROL: 'phone.control',
    PHONE_TOUCH: 'phone.touch',
    PHONE_APPS: 'phone.apps',
    PHONE_NOTIFICATIONS: 'phone.notifications',
    PHONE_CLIPBOARD: 'phone.clipboard',
    PHONE_CAMERA: 'phone.camera',
    PHONE_MICROPHONE: 'phone.microphone',
    // Administration
    USERS_MANAGE: 'users.manage',
    LOGS_VIEW: 'logs.view',
    SETTINGS_MANAGE: 'settings.manage',
};
exports.ALL_PERMISSIONS = Object.values(exports.PERMISSIONS);
exports.ROLE_DEFAULT_PERMISSIONS = {
    ADMIN: [...exports.ALL_PERMISSIONS],
    USER: [
        exports.PERMISSIONS.FILES_READ,
        exports.PERMISSIONS.FILES_DOWNLOAD,
        exports.PERMISSIONS.SYSTEM_VIEW,
        exports.PERMISSIONS.SCREEN_VIEW,
        exports.PERMISSIONS.PHONE_CLIPBOARD,
    ],
};
//# sourceMappingURL=permissions.js.map