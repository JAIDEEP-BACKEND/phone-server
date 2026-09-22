import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';
import { DeviceInfo } from '@android-server/shared';

export class DeviceInfoService {
  static getDeviceInfo(): DeviceInfo {
    let manufacturer = 'Android';
    let model = 'Phone Host';
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
    let ipAddress = '10.78.153.85';
    let detectedIps: string[] = [];
    const networkInterfaces = os.networkInterfaces();

    for (const name of Object.keys(networkInterfaces)) {
      for (const net of networkInterfaces[name] || []) {
        if (!net.internal && net.family === 'IPv4') {
          detectedIps.push(net.address);
          // Prioritize known hotspot / active cellular / Wi-Fi subnet interfaces
          if (
            net.address.startsWith('10.') ||
            net.address.startsWith('192.168.43.') ||
            net.address.startsWith('192.168.') ||
            name.includes('ap') ||
            name.includes('softap') ||
            name.includes('wlan') ||
            name.includes('swlan') ||
            name.includes('rndis') ||
            name.includes('rmnet')
          ) {
            ipAddress = net.address;
          }
        }
      }
    }

    if (process.env.HOTSPOT_IP) {
      ipAddress = process.env.HOTSPOT_IP;
    } else if (detectedIps.length > 0 && !detectedIps.includes(ipAddress)) {
      ipAddress = detectedIps[0];
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
      ipAddress,
      hostname: os.hostname(),
    };
  }
}
