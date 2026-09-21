import { Server as SocketIOServer, Socket } from 'socket.io';
import {
  DeviceCapabilities,
  DeviceInfo,
  AppInfo,
  NotificationItem,
  SOCKET_EVENTS,
  TouchPoint,
  SwipeGesture,
} from '@android-server/shared';
import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';
import { CONFIG } from '../config';
import { logAudit } from '../audit/audit-service';

export class CompanionBridge {
  private static companionSocket: Socket | null = null;
  private static ioInstance: SocketIOServer | null = null;

  // Real capability status
  private static capabilities: DeviceCapabilities = {
    screenCapture: 'REQUIRED',
    accessibility: 'REQUIRED',
    storage: fs.existsSync(CONFIG.STORAGE_ROOT) ? 'READY' : 'REQUIRED',
    notifications: 'REQUIRED',
    camera: 'REQUIRED',
    microphone: 'REQUIRED',
    root: 'UNAVAILABLE',
    companionConnected: false,
    lastSeenAt: null,
  };

  private static installedApps: AppInfo[] = [];
  private static notifications: NotificationItem[] = [];
  private static currentClipboardText: string = '';

  static init(io: SocketIOServer) {
    this.ioInstance = io;

    // Detect initial root status
    try {
      execSync('which su || type su', { stdio: 'ignore' });
      this.capabilities.root = 'READY';
    } catch {
      this.capabilities.root = 'UNAVAILABLE';
    }
  }

  /**
   * Registers an incoming Android Companion socket connection
   */
  static handleCompanionConnection(socket: Socket) {
    console.log('[COMPANION] Android companion connected:', socket.id);
    this.companionSocket = socket;
    this.capabilities.companionConnected = true;
    this.capabilities.lastSeenAt = new Date().toISOString();

    // Listen for capability status updates from Companion app
    socket.on('companion:status', (data: Partial<DeviceCapabilities>) => {
      this.capabilities = {
        ...this.capabilities,
        ...data,
        companionConnected: true,
        lastSeenAt: new Date().toISOString(),
      };
      this.broadcastCapabilities();
    });

    // Listen for screen frames from MediaProjection
    socket.on('companion:screen_frame', (framePayload: { data: string; width: number; height: number; fps?: number }) => {
      if (this.ioInstance) {
        this.ioInstance.to('room:remote-screen').emit(SOCKET_EVENTS.REMOTE_SCREEN_FRAME, {
          data: framePayload.data,
          width: framePayload.width,
          height: framePayload.height,
          fps: framePayload.fps || 30,
          timestamp: Date.now(),
        });
      }
    });

    // Listen for installed apps list from Companion
    socket.on('companion:installed_apps', (apps: AppInfo[]) => {
      this.installedApps = apps || [];
    });

    // Listen for notifications
    socket.on('companion:notifications', (items: NotificationItem[]) => {
      this.notifications = items || [];
      if (this.ioInstance) {
        this.ioInstance.to('room:remote-control').emit(SOCKET_EVENTS.REMOTE_NOTIFICATIONS_LIST, this.notifications);
      }
    });

    // Listen for clipboard content received from phone
    socket.on('companion:clipboard', (text: string) => {
      this.currentClipboardText = text;
      if (this.ioInstance) {
        this.ioInstance.to('room:remote-control').emit(SOCKET_EVENTS.REMOTE_CLIPBOARD_DATA, { text });
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

  static getCapabilities(): DeviceCapabilities {
    return { ...this.capabilities };
  }

  static getInstalledApps(): AppInfo[] {
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

  static getNotifications(): NotificationItem[] {
    return this.notifications;
  }

  static getDeviceInfo(): DeviceInfo {
    let manufacturer = 'OPPO';
    let model = 'CPH2219 (OPPO)';
    let androidVersion = '14';
    let sdkInt = 34;

    // Check Android getprop if available
    try {
      if (fs.existsSync('/system/build.prop') || process.platform === 'android') {
        const getprop = (prop: string) => execSync(`getprop ${prop}`, { encoding: 'utf8' }).trim();
        manufacturer = getprop('ro.product.manufacturer') || manufacturer;
        model = getprop('ro.product.model') || model;
        androidVersion = getprop('ro.build.version.release') || androidVersion;
        sdkInt = parseInt(getprop('ro.build.version.sdk') || '34', 10);
      }
    } catch {}

    const totalRamBytes = os.totalmem();
    const totalStorageBytes = 128 * 1024 * 1024 * 1024; // 128 GB OPPO Phone internal storage

    // Discover all LAN and Hotspot IPs
    let ipAddress = '127.0.0.1';
    let hotspotIp: string | null = null;
    const networkInterfaces = os.networkInterfaces();

    for (const name of Object.keys(networkInterfaces)) {
      for (const net of networkInterfaces[name] || []) {
        if (!net.internal && net.family === 'IPv4') {
          // Check if this is the Android hotspot AP subnet (typically 192.168.43.x)
          if (net.address.startsWith('192.168.43.') || name.includes('ap') || name.includes('softap')) {
            hotspotIp = net.address;
          } else if (ipAddress === '127.0.0.1') {
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
      kernelVersion: os.release(),
      architecture: os.arch(),
      totalRamBytes,
      totalStorageBytes,
      screenResolution: '1080 x 2400',
      refreshRateHz: 90,
      ipAddress: resolvedIp,
      hostname: os.hostname(),
      companionVersion: this.capabilities.companionConnected ? '1.0.0' : undefined,
    };
  }

  // --- Dispatch Actions to Companion App ---

  static sendTouch(type: 'down' | 'move' | 'up', point: TouchPoint): boolean {
    if (!this.companionSocket) return false;
    this.companionSocket.emit(`device:touch_${type}`, point);
    return true;
  }

  static sendSwipe(gesture: SwipeGesture): boolean {
    if (!this.companionSocket) return false;
    this.companionSocket.emit('device:gesture_swipe', gesture);
    return true;
  }

  static sendNavAction(action: 'back' | 'home' | 'recents' | 'lock'): boolean {
    if (!this.companionSocket) return false;
    this.companionSocket.emit('device:nav_action', { action });
    return true;
  }

  static sendVolumeAction(action: 'up' | 'down' | 'mute'): boolean {
    if (!this.companionSocket) return false;
    this.companionSocket.emit('device:volume_action', { action });
    return true;
  }

  static launchApp(packageName: string): boolean {
    if (!this.companionSocket) {
      // Fallback: in Termux, am start can be executed if Termux has permission
      try {
        execSync(`am start -n ${packageName}`, { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    }
    this.companionSocket.emit('device:launch_app', { packageName });
    return true;
  }

  static writeClipboard(text: string): boolean {
    if (!this.companionSocket) {
      // Fallback: termux-clipboard-set CLI if installed
      try {
        execSync(`termux-clipboard-set "${text.replace(/"/g, '\\"')}"`, { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    }
    this.companionSocket.emit('device:set_clipboard', { text });
    return true;
  }

  static requestClipboard(): boolean {
    if (!this.companionSocket) {
      try {
        const text = execSync('termux-clipboard-get', { encoding: 'utf8' }).trim();
        this.currentClipboardText = text;
        if (this.ioInstance) {
          this.ioInstance.to('room:remote-control').emit(SOCKET_EVENTS.REMOTE_CLIPBOARD_DATA, { text });
        }
        return true;
      } catch {
        return false;
      }
    }
    this.companionSocket.emit('device:get_clipboard');
    return true;
  }

  static startScreenCapture(): boolean {
    if (!this.companionSocket) return false;
    this.companionSocket.emit('device:screen_capture_start');
    return true;
  }

  static stopScreenCapture(): boolean {
    if (!this.companionSocket) return false;
    this.companionSocket.emit('device:screen_capture_stop');
    return true;
  }

  private static broadcastCapabilities() {
    if (this.ioInstance) {
      this.ioInstance.emit(SOCKET_EVENTS.DEVICE_CAPABILITIES, this.capabilities);
    }
  }
}
