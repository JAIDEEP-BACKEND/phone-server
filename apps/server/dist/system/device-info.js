"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceInfoService = void 0;
const os_1 = __importDefault(require("os"));
const fs_1 = __importDefault(require("fs"));
const child_process_1 = require("child_process");
class DeviceInfoService {
    static getDeviceInfo() {
        let manufacturer = 'OPPO';
        let model = 'CPH2219 (OPPO)';
        let androidVersion = '14';
        let sdkInt = 34;
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
        const totalStorageBytes = 128 * 1024 * 1024 * 1024;
        // Discover LAN and Hotspot IPs
        let ipAddress = '127.0.0.1';
        let hotspotIp = null;
        const networkInterfaces = os_1.default.networkInterfaces();
        for (const name of Object.keys(networkInterfaces)) {
            for (const net of networkInterfaces[name] || []) {
                if (!net.internal && net.family === 'IPv4') {
                    if (net.address.startsWith('192.168.43.') || name.includes('ap') || name.includes('softap')) {
                        hotspotIp = net.address;
                    }
                    else if (ipAddress === '127.0.0.1') {
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
            kernelVersion: os_1.default.release(),
            architecture: os_1.default.arch(),
            totalRamBytes,
            totalStorageBytes,
            screenResolution: '1080 x 2400',
            refreshRateHz: 90,
            ipAddress: hotspotIp || ipAddress,
            hostname: os_1.default.hostname(),
        };
    }
}
exports.DeviceInfoService = DeviceInfoService;
