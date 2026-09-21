import { Permission, Role } from './permissions';

export interface UserProfile {
  id: string;
  username: string;
  role: Role;
  permissions: Permission[];
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface FileItem {
  name: string;
  path: string; // Relative to STORAGE_ROOT
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
  extension: string;
  mimeType?: string;
  isSymlink?: boolean;
}

export interface StorageStats {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usedPercentage: number;
  mountPoint: string;
}

export interface CpuStats {
  usagePercent: number;
  cores: number;
  model?: string;
  loadAverage: [number, number, number];
}

export interface MemoryStats {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  availableBytes: number;
  usagePercent: number;
}

export interface NetworkStats {
  rxBytesPerSec: number;
  txBytesPerSec: number;
  totalRxBytes: number;
  totalTxBytes: number;
  interfaceName: string;
}

export interface BatteryStats {
  level: number; // 0 - 100
  isCharging: boolean;
  status: string; // Charging, Discharging, Full, Unknown
  temperatureCelsius: number | null;
  health?: string;
}

export interface SystemVitals {
  timestamp: number;
  uptimeSeconds: number;
  cpu: CpuStats;
  memory: MemoryStats;
  storage: StorageStats;
  network: NetworkStats;
  battery: BatteryStats;
  thermal: {
    cpuTempCelsius: number | null;
    batteryTempCelsius: number | null;
  };
  processCount: number;
}

export type CapabilityState = 'READY' | 'REQUIRED' | 'UNAVAILABLE' | 'ROOT_REQUIRED';

export interface DeviceCapabilities {
  screenCapture: CapabilityState;
  accessibility: CapabilityState;
  storage: CapabilityState;
  notifications: CapabilityState;
  camera: CapabilityState;
  microphone: CapabilityState;
  root: CapabilityState;
  companionConnected: boolean;
  lastSeenAt: string | null;
}

export interface DeviceInfo {
  manufacturer: string;
  model: string;
  androidVersion: string;
  sdkInt: number;
  kernelVersion: string;
  architecture: string;
  totalRamBytes: number;
  totalStorageBytes: number;
  screenResolution: string;
  refreshRateHz: number;
  ipAddress: string;
  hostname: string;
  companionVersion?: string;
}

export interface AppInfo {
  name: string;
  packageName: string;
  versionName?: string;
  isSystemApp: boolean;
  iconDataUrl?: string;
}

export interface NotificationItem {
  id: string;
  key: string;
  packageName: string;
  appName: string;
  title: string;
  text: string;
  postTime: number;
  isClearable: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string | null;
  username: string;
  action: string;
  target: string;
  status: 'SUCCESS' | 'FAILURE' | 'DENIED' | 'ERROR';
  ipAddress: string;
  details?: string;
}
