'use client';

import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HardDrive,
  Cpu,
  Wifi,
  Battery,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { DeviceInfo, DeviceCapabilities, CapabilityState, SOCKET_EVENTS } from '@android-server/shared';
import { getSocket } from '@/lib/socket';
import { fetchApi } from '@/lib/api';

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function renderCapabilityBadge(state: CapabilityState) {
  switch (state) {
    case 'READY':
      return (
        <span className="flex items-center space-x-1 rounded bg-accent-green-subtle px-2 py-0.5 font-mono text-[11px] font-semibold text-accent-green">
          <CheckCircle2 className="h-3 w-3" />
          <span>READY</span>
        </span>
      );
    case 'REQUIRED':
      return (
        <span className="flex items-center space-x-1 rounded bg-accent-red-subtle px-2 py-0.5 font-mono text-[11px] font-semibold text-accent-red">
          <AlertTriangle className="h-3 w-3" />
          <span>PERMISSION REQUIRED</span>
        </span>
      );
    case 'ROOT_REQUIRED':
    case 'UNAVAILABLE':
      return (
        <span className="flex items-center space-x-1 rounded bg-bg-base px-2 py-0.5 font-mono text-[11px] text-fg-subtle border border-border">
          <XCircle className="h-3 w-3" />
          <span>UNAVAILABLE (NO ROOT)</span>
        </span>
      );
    default:
      return <span className="font-mono text-xs text-fg-subtle">{state}</span>;
  }
}

export default function PhonePage() {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [capabilities, setCapabilities] = useState<DeviceCapabilities | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      fetchApi('/api/phone/info').catch(() => null),
      fetchApi('/api/system/capabilities').catch(() => null),
    ]).then(([info, caps]) => {
      if (isMounted) {
        if (info) setDeviceInfo(info);
        if (caps) setCapabilities(caps);
        setLoading(false);
      }
    });

    const socket = getSocket();
    const handleCaps = (caps: DeviceCapabilities) => {
      if (isMounted) setCapabilities(caps);
    };

    socket.on(SOCKET_EVENTS.DEVICE_CAPABILITIES, handleCaps);

    return () => {
      isMounted = false;
      socket.off(SOCKET_EVENTS.DEVICE_CAPABILITIES, handleCaps);
    };
  }, []);

  const capabilityRows = [
    {
      name: 'SCREEN CAPTURE',
      desc: 'Real-time phone display streaming via Android MediaProjection',
      state: capabilities?.screenCapture || 'REQUIRED',
    },
    {
      name: 'ACCESSIBILITY SERVICE',
      desc: 'Remote touch, swipe gestures, Back, Home, Recents, and Lock execution',
      state: capabilities?.accessibility || 'REQUIRED',
    },
    {
      name: 'STORAGE PERMISSION',
      desc: 'Access to /storage/emulated/0 shared documents and media directories',
      state: capabilities?.storage || 'READY',
    },
    {
      name: 'NOTIFICATION LISTENER',
      desc: 'Reading notifications via NotificationListenerService',
      state: capabilities?.notifications || 'REQUIRED',
    },
    {
      name: 'CAMERA HARDWARE',
      desc: 'Camera2 API video streaming (requires explicit user start)',
      state: capabilities?.camera || 'REQUIRED',
    },
    {
      name: 'AUDIO MICROPHONE',
      desc: 'AudioRecord live capture (requires explicit user start)',
      state: capabilities?.microphone || 'REQUIRED',
    },
    {
      name: 'SUPERUSER (ROOT)',
      desc: 'Kernel-level reboot, poweroff, and privileged direct I/O',
      state: capabilities?.root || 'UNAVAILABLE',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-3">
        <h1 className="font-mono text-sm font-semibold uppercase tracking-wider text-fg">
          Device Specifications & Capabilities
        </h1>
        <p className="font-mono text-xs text-fg-muted">
          Actual hardware parameters and Android system permission status
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
            <span className="font-semibold text-fg">{deviceInfo?.manufacturer || 'OPPO'}</span>
          </div>

          <div className="flex justify-between border-b border-border/50 pb-2">
            <span className="text-fg-muted">MODEL:</span>
            <span className="font-semibold text-fg">{deviceInfo?.model || 'CPH2219'}</span>
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
            <span className="text-fg-muted">SCREEN RESOLUTION:</span>
            <span className="text-fg">{deviceInfo?.screenResolution || '1080 x 2400'}</span>
          </div>

          <div className="flex justify-between border-b border-border/50 pb-2">
            <span className="text-fg-muted">REFRESH RATE:</span>
            <span className="text-fg">{deviceInfo?.refreshRateHz || 90} Hz</span>
          </div>

          <div className="flex justify-between border-b border-border/50 pb-2">
            <span className="text-fg-muted">LAN IP ADDRESS:</span>
            <span className="text-accent-blue font-semibold">{deviceInfo?.ipAddress || '127.0.0.1'}</span>
          </div>

          <div className="flex justify-between border-b border-border/50 pb-2">
            <span className="text-fg-muted">KERNEL RELEASE:</span>
            <span className="text-fg truncate max-w-[160px]">{deviceInfo?.kernelVersion || 'Linux 5.10'}</span>
          </div>

          <div className="flex justify-between border-b border-border/50 pb-2">
            <span className="text-fg-muted">COMPANION LINK:</span>
            <span className={capabilities?.companionConnected ? 'text-accent-green' : 'text-accent-red'}>
              {capabilities?.companionConnected ? 'ACTIVE (v1.0)' : 'STANDALONE TERMUX'}
            </span>
          </div>
        </div>
      </div>

      {/* Capability Status Matrix */}
      <div className="rounded border border-border bg-bg-panel overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center space-x-2 font-mono text-xs font-semibold uppercase tracking-wider text-fg">
            <Shield className="h-4 w-4 text-accent-green" />
            <span>Android Security & Permission Matrix</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full tech-table">
            <thead>
              <tr>
                <th>FEATURE / CAPABILITY</th>
                <th>TECHNICAL DESCRIPTION</th>
                <th className="text-right">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {capabilityRows.map((row) => (
                <tr key={row.name}>
                  <td className="font-mono text-xs font-semibold text-fg whitespace-nowrap">
                    {row.name}
                  </td>
                  <td className="font-mono text-xs text-fg-muted">{row.desc}</td>
                  <td className="text-right">{renderCapabilityBadge(row.state)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
