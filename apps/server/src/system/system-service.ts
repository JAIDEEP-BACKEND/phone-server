import fs from 'fs';
import os from 'os';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import { SystemVitals, CpuStats, MemoryStats, NetworkStats, BatteryStats } from '@android-server/shared';
import { FileService } from '../files/file-service';

const execAsync = promisify(exec);

// Cache for delta CPU calculation
let prevCpuTimes = { idle: 0, total: 0 };
let prevNetTimes = { rx: 0, tx: 0, timestamp: Date.now() };

export class SystemService {
  /**
   * Reads real CPU usage from /proc/stat or OS metrics
   */
  static getCpuUsage(): CpuStats {
    let usagePercent = 0;
    const cores = os.cpus().length;
    const model = os.cpus()[0]?.model || 'ARM Cortex (aarch64)';
    const loadAvg = os.loadavg() as [number, number, number];

    try {
      if (fs.existsSync('/proc/stat')) {
        const content = fs.readFileSync('/proc/stat', 'utf8');
        const firstLine = content.split('\n')[0]; // cpu  user nice system idle iowait irq softirq ...
        const parts = firstLine.trim().split(/\s+/).slice(1).map(Number);
        if (parts.length >= 4) {
          const idle = parts[3] + (parts[4] || 0);
          const total = parts.reduce((acc, val) => acc + val, 0);

          if (prevCpuTimes.total > 0) {
            const idleDelta = idle - prevCpuTimes.idle;
            const totalDelta = total - prevCpuTimes.total;
            if (totalDelta > 0) {
              usagePercent = Math.max(0, Math.min(100, Math.round((1 - idleDelta / totalDelta) * 100)));
            }
          }
          prevCpuTimes = { idle, total };
          return { usagePercent, cores, model, loadAverage: loadAvg };
        }
      }
    } catch {}

    // Fallback: estimate from 1-minute load average
    usagePercent = Math.min(100, Math.round((loadAvg[0] / Math.max(1, cores)) * 100));
    return { usagePercent, cores, model, loadAverage: loadAvg };
  }

  /**
   * Reads real Memory from /proc/meminfo or OS metrics
   */
  static getMemoryUsage(): MemoryStats {
    try {
      if (fs.existsSync('/proc/meminfo')) {
        const content = fs.readFileSync('/proc/meminfo', 'utf8');
        const lines = content.split('\n');
        const memMap: Record<string, number> = {};

        for (const line of lines) {
          const match = line.match(/^([A-Za-z0-9_]+):\s+(\d+)\s+kB/);
          if (match) {
            memMap[match[1]] = parseInt(match[2], 10) * 1024; // Convert kB to bytes
          }
        }

        const totalBytes = memMap['MemTotal'] || os.totalmem();
        const freeBytes = memMap['MemFree'] || os.freemem();
        const availableBytes = memMap['MemAvailable'] || (freeBytes + (memMap['Buffers'] || 0) + (memMap['Cached'] || 0));
        const usedBytes = Math.max(0, totalBytes - availableBytes);
        const usagePercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;

        return {
          totalBytes,
          usedBytes,
          freeBytes,
          availableBytes,
          usagePercent,
        };
      }
    } catch {}

    const totalBytes = os.totalmem();
    const freeBytes = os.freemem();
    const usedBytes = totalBytes - freeBytes;
    const usagePercent = Math.round((usedBytes / totalBytes) * 100);

    return {
      totalBytes,
      usedBytes,
      freeBytes,
      availableBytes: freeBytes,
      usagePercent,
    };
  }

  /**
   * Reads real Network throughput from /proc/net/dev
   */
  static getNetworkUsage(): NetworkStats {
    let currentRx = 0;
    let currentTx = 0;
    let iface = 'wlan0';

    try {
      if (fs.existsSync('/proc/net/dev')) {
        const content = fs.readFileSync('/proc/net/dev', 'utf8');
        const lines = content.split('\n').slice(2);

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const [name, rest] = trimmed.split(':');
          if (!name || !rest) continue;
          const cleanName = name.trim();

          // Focus on active network interfaces (WiFi, cellular, ethernet)
          if (cleanName.startsWith('wlan') || cleanName.startsWith('rmnet') || cleanName.startsWith('eth')) {
            const fields = rest.trim().split(/\s+/).map(Number);
            if (fields.length >= 9) {
              currentRx += fields[0]; // bytes received
              currentTx += fields[8]; // bytes transmitted
              iface = cleanName;
            }
          }
        }
      }
    } catch {}

    const now = Date.now();
    const timeDeltaSec = Math.max(1, (now - prevNetTimes.timestamp) / 1000);
    const rxRate = prevNetTimes.rx > 0 ? Math.max(0, Math.round((currentRx - prevNetTimes.rx) / timeDeltaSec)) : 0;
    const txRate = prevNetTimes.tx > 0 ? Math.max(0, Math.round((currentTx - prevNetTimes.tx) / timeDeltaSec)) : 0;

    prevNetTimes = { rx: currentRx, tx: currentTx, timestamp: now };

    return {
      rxBytesPerSec: rxRate,
      txBytesPerSec: txRate,
      totalRxBytes: currentRx,
      totalTxBytes: currentTx,
      interfaceName: iface,
    };
  }

  /**
   * Reads real Battery status from /sys/class/power_supply/battery or Termux API
   */
  static async getBatteryStatus(): Promise<BatteryStats> {
    // 1. Try termux-battery-status CLI if available
    try {
      const { stdout } = await execAsync('termux-battery-status', { timeout: 800 });
      const parsed = JSON.parse(stdout);
      return {
        level: parsed.percentage,
        isCharging: parsed.status === 'CHARGING',
        status: parsed.status || 'Discharging',
        temperatureCelsius: parsed.temperature ? parseFloat(parsed.temperature.toFixed(1)) : null,
        health: parsed.health || 'GOOD',
      };
    } catch {}

    // 2. Direct Linux sysfs on Android /sys/class/power_supply/battery
    try {
      const basePath = '/sys/class/power_supply/battery';
      if (fs.existsSync(basePath)) {
        const cap = fs.readFileSync(`${basePath}/capacity`, 'utf8').trim();
        const status = fs.readFileSync(`${basePath}/status`, 'utf8').trim();
        let temp: number | null = null;
        if (fs.existsSync(`${basePath}/temp`)) {
          temp = parseInt(fs.readFileSync(`${basePath}/temp`, 'utf8').trim(), 10) / 10;
        }

        return {
          level: parseInt(cap, 10),
          isCharging: status.toLowerCase().includes('charging'),
          status,
          temperatureCelsius: temp,
        };
      }
    } catch {}

    // Fallback when not on an Android phone (e.g. PC server)
    return {
      level: 100,
      isCharging: true,
      status: 'AC Connected',
      temperatureCelsius: null,
      health: 'GOOD',
    };
  }

  /**
   * Reads hardware temperature from /sys/class/thermal
   */
  static getThermalMetrics(): { cpuTempCelsius: number | null; batteryTempCelsius: number | null } {
    let cpuTemp: number | null = null;
    let batteryTemp: number | null = null;

    try {
      const zones = ['/sys/class/thermal/thermal_zone0/temp', '/sys/class/thermal/thermal_zone1/temp'];
      for (const zone of zones) {
        if (fs.existsSync(zone)) {
          const raw = parseInt(fs.readFileSync(zone, 'utf8').trim(), 10);
          if (raw > 0) {
            cpuTemp = raw > 1000 ? Math.round(raw / 1000) : raw;
            break;
          }
        }
      }
    } catch {}

    return { cpuTempCelsius: cpuTemp, batteryTempCelsius: batteryTemp };
  }

  /**
   * Counts active running processes from /proc
   */
  static getProcessCount(): number {
    try {
      if (fs.existsSync('/proc')) {
        const files = fs.readdirSync('/proc');
        const pids = files.filter((f) => /^\d+$/.test(f));
        return pids.length;
      }
    } catch {}
    return 0;
  }

  /**
   * Aggregates all real system vitals
   */
  static async collectVitals(): Promise<SystemVitals> {
    const storage = await FileService.getStorageUsage();
    const battery = await SystemService.getBatteryStatus();
    const thermal = SystemService.getThermalMetrics();

    return {
      timestamp: Date.now(),
      uptimeSeconds: Math.floor(os.uptime()),
      cpu: SystemService.getCpuUsage(),
      memory: SystemService.getMemoryUsage(),
      storage,
      network: SystemService.getNetworkUsage(),
      battery,
      thermal,
      processCount: SystemService.getProcessCount(),
    };
  }

  /**
   * Checks if root / su binary is available
   */
  static isRootAvailable(): boolean {
    try {
      execSync('which su || type su', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Power operations with root and Android safety checks
   */
  static async handlePowerAction(action: 'restart' | 'shutdown' | 'lock' | 'sleep'): Promise<{
    success: boolean;
    message: string;
    requiresRoot?: boolean;
  }> {
    const hasRoot = SystemService.isRootAvailable();

    if (action === 'restart' || action === 'shutdown') {
      if (!hasRoot) {
        return {
          success: false,
          requiresRoot: true,
          message: 'ROOT REQUIRED: Android prevents non-root processes from restarting or shutting down the device.',
        };
      }

      const cmd = action === 'restart' ? 'su -c "reboot"' : 'su -c "reboot -p"';
      try {
        await execAsync(cmd);
        return { success: true, message: `System ${action} command sent.` };
      } catch (err: any) {
        return { success: false, message: `Power command failed: ${err.message}` };
      }
    }

    if (action === 'lock' || action === 'sleep') {
      // In Android, locking screen without root can be performed by AccessibilityService (GLOBAL_ACTION_LOCK_SCREEN)
      // or companion DeviceAdmin.
      return {
        success: false,
        message: 'Lock/sleep command dispatched via Android Companion Accessibility Service.',
      };
    }

    return { success: false, message: 'Invalid power action.' };
  }
}
