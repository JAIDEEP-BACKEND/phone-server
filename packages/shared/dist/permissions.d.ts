export declare const PERMISSIONS: {
    readonly FILES_READ: "files.read";
    readonly FILES_WRITE: "files.write";
    readonly FILES_UPLOAD: "files.upload";
    readonly FILES_DOWNLOAD: "files.download";
    readonly FILES_DELETE: "files.delete";
    readonly FILES_RENAME: "files.rename";
    readonly FILES_MOVE: "files.move";
    readonly SHELL_ACCESS: "shell.access";
    readonly SYSTEM_VIEW: "system.view";
    readonly SYSTEM_POWER: "system.power";
    readonly SCREEN_VIEW: "screen.view";
    readonly PHONE_CONTROL: "phone.control";
    readonly PHONE_TOUCH: "phone.touch";
    readonly PHONE_APPS: "phone.apps";
    readonly PHONE_NOTIFICATIONS: "phone.notifications";
    readonly PHONE_CLIPBOARD: "phone.clipboard";
    readonly PHONE_CAMERA: "phone.camera";
    readonly PHONE_MICROPHONE: "phone.microphone";
    readonly USERS_MANAGE: "users.manage";
    readonly LOGS_VIEW: "logs.view";
    readonly SETTINGS_MANAGE: "settings.manage";
};
export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];
export declare const ALL_PERMISSIONS: Permission[];
export type Role = 'ADMIN' | 'USER';
export declare const ROLE_DEFAULT_PERMISSIONS: Record<Role, Permission[]>;
//# sourceMappingURL=permissions.d.ts.map