"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanionBridge = void 0;
const shared_1 = require("@android-server/shared");
const os_1 = __importDefault(require("os"));
const fs_1 = __importDefault(require("fs"));
const child_process_1 = require("child_process");
const config_1 = require("../config");
class CompanionBridge {
    static companionSocket = null;
    static ioInstance = null;
    // Real capability status
    static capabilities = {
        screenCapture: 'REQUIRED',
        accessibility: 'REQUIRED',
        storage: fs_1.default.existsSync(config_1.CONFIG.STORAGE_ROOT) ? 'READY' : 'REQUIRED',
        notifications: 'REQUIRED',
        camera: 'REQUIRED',
        microphone: 'REQUIRED',
        root: 'UNAVAILABLE',
        companionConnected: false,
        lastSeenAt: null,
    };
    static installedApps = [];
    static notifications = [];
    static currentClipboardText = '';
    static init(io) {
        this.ioInstance = io;
        // Detect initial root status
        try {
            (0, child_process_1.execSync)('which su || type su', { stdio: 'ignore' });
            this.capabilities.root = 'READY';
        }
        catch {
            this.capabilities.root = 'UNAVAILABLE';
        }
    }
    /**
     * Registers an incoming Android Companion socket connection
     */
    static handleCompanionConnection(socket) {
        console.log('[COMPANION] Android companion connected:', socket.id);
        this.companionSocket = socket;
        this.capabilities.companionConnected = true;
        this.capabilities.lastSeenAt = new Date().toISOString();
        // Listen for capability status updates from Companion app
        socket.on('companion:status', (data) => {
            this.capabilities = {
                ...this.capabilities,
                ...data,
                companionConnected: true,
                lastSeenAt: new Date().toISOString(),
            };
            this.broadcastCapabilities();
        });
        // Listen for screen frames from MediaProjection
        socket.on('companion:screen_frame', (framePayload) => {
            if (this.ioInstance) {
                this.ioInstance.to('room:remote-screen').emit(shared_1.SOCKET_EVENTS.REMOTE_SCREEN_FRAME, {
                    data: framePayload.data,
                    width: framePayload.width,
                    height: framePayload.height,
                    fps: framePayload.fps || 30,
                    timestamp: Date.now(),
                });
            }
        });
        // Listen for installed apps list from Companion
        socket.on('companion:installed_apps', (apps) => {
            this.installedApps = apps || [];
        });
        // Listen for notifications
        socket.on('companion:notifications', (items) => {
            this.notifications = items || [];
            if (this.ioInstance) {
                this.ioInstance.to('room:remote-control').emit(shared_1.SOCKET_EVENTS.REMOTE_NOTIFICATIONS_LIST, this.notifications);
            }
        });
        // Listen for clipboard content received from phone
        socket.on('companion:clipboard', (text) => {
            this.currentClipboardText = text;
            if (this.ioInstance) {
                this.ioInstance.to('room:remote-control').emit(shared_1.SOCKET_EVENTS.REMOTE_CLIPBOARD_DATA, { text });
            }
        });
        socket.on('disconnect', () => {
            console.log('[COMPANION] Android companion disconnected.');
            this.companionSocket = null;
            this.capabilities.companionConnected = false;
            this.capabilities.screenCapture = 'REQUIRED';
            this.capabilities.accessibility = 'REQUIRED';
            this.broadcastCapabilities();
        });
        this.broadcastCapabilities();
    }
    static getCapabilities() {
        return { ...this.capabilities };
    }
    static getInstalledApps() {
        // If companion hasn't reported apps yet, return standard Android default app entries
        if (this.installedApps.length === 0) {
            return [
                { name: 'Settings', packageName: 'com.android.settings', isSystemApp: true },
                { name: 'Files', packageName: 'com.android.documentsui', isSystemApp: true },
                { name: 'Chrome', packageName: 'com.android.chrome', isSystemApp: false },
                { name: 'Camera', packageName: 'com.android.camera', isSystemApp: true },
                { name: 'Termux', packageName: 'com.termux', isSystemApp: false },
            ];
        }
        return this.installedApps;
    }
    static getNotifications() {
        return this.notifications;
    }
    static getDeviceInfo() {
        let manufacturer = 'OPPO';
        let model = 'CPH2219 (OPPO)';
        let androidVersion = '14';
        let sdkInt = 34;
        // Check Android getprop if available
        try {
            if (fs_1.default.existsSync('/system/build.prop') || process.platform === 'android') {
                const getprop = (prop) => (0, child_process_1.execSync)(`getprop ${prop}`, { encoding: 'utf8' }).trim();
                manufacturer = getprop('ro.product.manufacturer') || manufacturer;
                model = getprop('ro.product.model') || model;
                androidVersion = getprop('ro.build.version.release') || androidVersion;
                sdkInt = parseInt(getprop('ro.build.version.sdk') || '34', 10);
            }
        }
        catch { }
        const totalRamBytes = os_1.default.totalmem();
        const totalStorageBytes = 128 * 1024 * 1024 * 1024; // 128 GB OPPO Phone internal storage
        // Discover all LAN and Hotspot IPs
        let ipAddress = '127.0.0.1';
        let hotspotIp = null;
        const networkInterfaces = os_1.default.networkInterfaces();
        for (const name of Object.keys(networkInterfaces)) {
            for (const net of networkInterfaces[name] || []) {
                if (!net.internal && net.family === 'IPv4') {
                    // Check if this is the Android hotspot AP subnet (typically 192.168.43.x)
                    if (net.address.startsWith('192.168.43.') || name.includes('ap') || name.includes('softap')) {
                        hotspotIp = net.address;
                    }
                    else if (ipAddress === '127.0.0.1') {
                        ipAddress = net.address;
                    }
                }
            }
        }
        // Prefer hotspot IP if active, otherwise standard LAN IP
        const resolvedIp = hotspotIp || ipAddress;
        return {
            manufacturer,
            model,
            androidVersion,
            sdkInt,
            kernelVersion: os_1.default.release(),
            architecture: os_1.default.arch(),
            totalRamBytes,
            totalStorageBytes,
            screenResolution: '1080 x 2400',
            refreshRateHz: 90,
            ipAddress: resolvedIp,
            hostname: os_1.default.hostname(),
            companionVersion: this.capabilities.companionConnected ? '1.0.0' : undefined,
        };
    }
    // --- Dispatch Actions to Companion App ---
    static sendTouch(type, point) {
        if (!this.companionSocket)
            return false;
        this.companionSocket.emit(`device:touch_${type}`, point);
        return true;
    }
    static sendSwipe(gesture) {
        if (!this.companionSocket)
            return false;
        this.companionSocket.emit('device:gesture_swipe', gesture);
        return true;
    }
    static sendNavAction(action) {
        if (!this.companionSocket)
            return false;
        this.companionSocket.emit('device:nav_action', { action });
        return true;
    }
    static sendVolumeAction(action) {
        if (!this.companionSocket)
            return false;
        this.companionSocket.emit('device:volume_action', { action });
        return true;
    }
    static launchApp(packageName) {
        if (!this.companionSocket) {
            // Fallback: in Termux, am start can be executed if Termux has permission
            try {
                (0, child_process_1.execSync)(`am start -n ${packageName}`, { stdio: 'ignore' });
                return true;
            }
            catch {
                return false;
            }
        }
        this.companionSocket.emit('device:launch_app', { packageName });
        return true;
    }
    static writeClipboard(text) {
        if (!this.companionSocket) {
            // Fallback: termux-clipboard-set CLI if installed
            try {
                (0, child_process_1.execSync)(`termux-clipboard-set "${text.replace(/"/g, '\\"')}"`, { stdio: 'ignore' });
                return true;
            }
            catch {
                return false;
            }
        }
        this.companionSocket.emit('device:set_clipboard', { text });
        return true;
    }
    static requestClipboard() {
        if (!this.companionSocket) {
            try {
                const text = (0, child_process_1.execSync)('termux-clipboard-get', { encoding: 'utf8' }).trim();
                this.currentClipboardText = text;
                if (this.ioInstance) {
                    this.ioInstance.to('room:remote-control').emit(shared_1.SOCKET_EVENTS.REMOTE_CLIPBOARD_DATA, { text });
                }
                return true;
            }
            catch {
                return false;
            }
        }
        this.companionSocket.emit('device:get_clipboard');
        return true;
    }
    static startScreenCapture() {
        if (!this.companionSocket)
            return false;
        this.companionSocket.emit('device:screen_capture_start');
        return true;
    }
    static stopScreenCapture() {
        if (!this.companionSocket)
            return false;
        this.companionSocket.emit('device:screen_capture_stop');
        return true;
    }
    static broadcastCapabilities() {
        if (this.ioInstance) {
            this.ioInstance.emit(shared_1.SOCKET_EVENTS.DEVICE_CAPABILITIES, this.capabilities);
        }
    }
}
exports.CompanionBridge = CompanionBridge;
