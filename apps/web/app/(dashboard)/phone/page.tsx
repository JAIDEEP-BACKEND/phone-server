'use client';

import React, { useState, useEffect } from 'react';
import { Smartphone, HardDrive, Cpu, Wifi, Server, CheckCircle2 } from 'lucide-react';
import { DeviceInfo } from '@android-server/shared';
import { fetchApi } from '@/lib/api';

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function PhonePage() {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi('/api/phone/info')
      .then((info) => {
        if (info) setDeviceInfo(info);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-3">
        <h1 className="font-mono text-sm font-semibold uppercase tracking-wider text-fg">
          Device Hardware & Environment
        </h1>
        <p className="font-mono text-xs text-fg-muted">
          Android host specifications, kernel release, and local network addresses
        </p>
      </div>

      {/* Hardware Telemetry Card */}
      <div className="rounded border border-border bg-bg-panel p-5">
        <div className="mb-4 flex items-center space-x-2 font-mono text-xs font-semibold text-fg">
          <Smartphone className="h-4 w-4 text-accent-blue" />
          <span>HOST HARDWARE PROFILE</span>
        </div>

        <div className="grid grid-cols-1 gap-y-3 gap-x-8 sm:grid-cols-2 lg:grid-cols-3 font-mono text-xs">
          <div className="flex justify-between border-b border-border/50 pb-2">
            <span className="text-fg-muted">MANUFACTURER:</span>
            <span className="font-semibold text-fg">{deviceInfo?.manufacturer || 'Android'}</span>
          </div>

          <div className="flex justify-between border-b border-border/50 pb-2">
            <span className="text-fg-muted">MODEL:</span>
            <span className="font-semibold text-fg">{deviceInfo?.model || 'Phone Host'}</span>
          </div>

          <div className="flex justify-between border-b border-border/50 pb-2">
            <span className="text-fg-muted">ANDROID VERSION:</span>
            <span className="font-semibold text-accent-green">
              {deviceInfo?.androidVersion || '14'} (API {deviceInfo?.sdkInt || 34})
            </span>
          </div>

          <div className="flex justify-between border-b border-border/50 pb-2">
            <span className="text-fg-muted">ARCHITECTURE:</span>
            <span className="text-fg">{deviceInfo?.architecture || 'aarch64'}</span>
          </div>

          <div className="flex justify-between border-b border-border/50 pb-2">
            <span className="text-fg-muted">SYSTEM MEMORY:</span>
            <span className="text-fg">{formatBytes(deviceInfo?.totalRamBytes || 8 * 1024 ** 3)}</span>
          </div>

          <div className="flex justify-between border-b border-border/50 pb-2">
            <span className="text-fg-muted">INTERNAL STORAGE:</span>
            <span className="text-fg">{formatBytes(deviceInfo?.totalStorageBytes || 128 * 1024 ** 3)}</span>
          </div>

          <div className="flex justify-between border-b border-border/50 pb-2">
            <span className="text-fg-muted">HOTSPOT / LAN IP:</span>
            <span className="text-accent-blue font-semibold">{deviceInfo?.ipAddress || '192.168.43.1'}</span>
          </div>

          <div className="flex justify-between border-b border-border/50 pb-2">
            <span className="text-fg-muted">KERNEL RELEASE:</span>
            <span className="text-fg truncate max-w-[160px]">{deviceInfo?.kernelVersion || 'Linux 5.10'}</span>
          </div>

          <div className="flex justify-between border-b border-border/50 pb-2">
            <span className="text-fg-muted">SERVER RUNTIME:</span>
            <span className="text-accent-green font-semibold">
              TERMUX (NODE.JS)
            </span>
          </div>
        </div>
      </div>

      {/* Storage & Hotspot Overview */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded border border-border bg-bg-panel p-4 space-y-2 font-mono text-xs">
          <div className="flex items-center space-x-2 text-fg font-semibold">
            <HardDrive className="h-4 w-4 text-accent-blue" />
            <span>Shared Storage Access</span>
          </div>
          <p className="text-fg-muted text-[11px] leading-relaxed">
            The server accesses <code>/storage/emulated/0</code> directly. All files under DCIM, Pictures, Documents, Movies, and Downloads are manageable from the <strong>FILES</strong> view.
          </p>
        </div>

        <div className="rounded border border-border bg-bg-panel p-4 space-y-2 font-mono text-xs">
          <div className="flex items-center space-x-2 text-fg font-semibold">
            <Wifi className="h-4 w-4 text-accent-green" />
            <span>Hotspot Connection</span>
          </div>
          <p className="text-fg-muted text-[11px] leading-relaxed">
            When your phone hotspot is turned on, the gateway IP is <code>192.168.43.1</code>. Connect your PC to the phone hotspot and access the console at <code>http://192.168.43.1:3001</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
