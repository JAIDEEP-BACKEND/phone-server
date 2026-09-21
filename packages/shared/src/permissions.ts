export const PERMISSIONS = {
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
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

export type Role = 'ADMIN' | 'USER';

export const ROLE_DEFAULT_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [...ALL_PERMISSIONS],
  USER: [
    PERMISSIONS.FILES_READ,
    PERMISSIONS.FILES_DOWNLOAD,
    PERMISSIONS.SYSTEM_VIEW,
    PERMISSIONS.SCREEN_VIEW,
    PERMISSIONS.PHONE_CLIPBOARD,
  ],
};
