import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';
import { DeviceInfo } from '@android-server/shared';

export class DeviceInfoService {
  static getDeviceInfo(): DeviceInfo {
    let manufacturer = 'OPPO';
    let model = 'CPH2219 (OPPO)';
    let androidVersion = '14';
    let sdkInt = 34;

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
    const totalStorageBytes = 128 * 1024 * 1024 * 1024;

    // Discover LAN and Hotspot IPs
    let ipAddress = '127.0.0.1';
    let hotspotIp: string | null = null;
    const networkInterfaces = os.networkInterfaces();

    for (const name of Object.keys(networkInterfaces)) {
      for (const net of networkInterfaces[name] || []) {
        if (!net.internal && net.family === 'IPv4') {
          if (net.address.startsWith('192.168.43.') || name.includes('ap') || name.includes('softap')) {
            hotspotIp = net.address;
          } else if (ipAddress === '127.0.0.1') {
            ipAddress = net.address;
          }
        }
      }
    }

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
      ipAddress: hotspotIp || ipAddress,
      hostname: os.hostname(),
    };
  }
}
