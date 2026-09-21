'use client';

import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Activity,
  HardDrive,
  Wifi,
  Thermometer,
  Clock,
  Layers,
  Power,
  RotateCcw,
  Lock,
  Moon,
  AlertTriangle,
  X,
} from 'lucide-react';
import { SystemVitals, SOCKET_EVENTS } from '@android-server/shared';
import { getSocket } from '@/lib/socket';
import { fetchApi } from '@/lib/api';

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function SystemPage() {
  const [vitals, setVitals] = useState<SystemVitals | null>(null);
  const [powerModal, setPowerModal] = useState<{
    action: 'restart' | 'shutdown' | 'lock' | 'sleep';
    title: string;
  } | null>(null);
  const [powerResult, setPowerResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isActing, setIsActing] = useState(false);

  useEffect(() => {
    let isMounted = true;
    fetchApi('/api/system/stats')
      .then((data) => {
        if (isMounted) setVitals(data);
      })
      .catch(() => {});

    const socket = getSocket();
    socket.emit(SOCKET_EVENTS.SYSTEM_STATS_SUBSCRIBE);

    const handleVitals = (data: SystemVitals) => {
      if (isMounted) setVitals(data);
    };

    socket.on(SOCKET_EVENTS.SYSTEM_STATS, handleVitals);

    return () => {
      isMounted = false;
      socket.emit(SOCKET_EVENTS.SYSTEM_STATS_UNSUBSCRIBE);
      socket.off(SOCKET_EVENTS.SYSTEM_STATS, handleVitals);
    };
  }, []);

  const executePowerAction = async () => {
    if (!powerModal) return;
    setIsActing(true);
    setPowerResult(null);

    try {
      const res = await fetchApi('/api/system/power', {
        method: 'POST',
        body: JSON.stringify({ action: powerModal.action }),
      });
      setPowerResult(res);
    } catch (err: any) {
      setPowerResult({ success: false, message: err.message || 'Action failed.' });
    } finally {
      setIsActing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
        <div>
          <h1 className="font-orbitron text-sm font-bold uppercase tracking-widest text-cyan-300 text-glow-cyan">
            REAL-TIME SYSTEM TELEMETRY
          </h1>
          <p className="font-mono text-xs text-slate-400">
            Direct /proc, sysfs, and hardware metrics collected at 1Hz
          </p>
        </div>
      </div>

      {powerResult && (
        <div
          className={`flex items-center justify-between rounded-lg border p-3.5 font-mono text-xs ${
            powerResult.success
              ? 'border-emerald-500/50 bg-emerald-950/30 text-emerald-300'
              : 'border-rose-500/50 bg-rose-950/30 text-rose-300'
          }`}
        >
          <span>{powerResult.message}</span>
          <button onClick={() => setPowerResult(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Telemetry Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* CPU */}
        <div className="hud-card rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between text-slate-400 font-mono text-xs">
            <span className="flex items-center space-x-2">
              <Cpu className="h-4 w-4 text-cyan-400" />
              <span className="font-orbitron font-bold text-cyan-400">PROCESSOR</span>
            </span>
            <span className="font-orbitron text-base font-black text-cyan-300 text-glow-cyan">{vitals?.cpu.usagePercent ?? 0}%</span>
          </div>
          <div className="h-2 w-full rounded bg-slate-900 overflow-hidden border border-cyan-500/20">
            <div
              className={`h-full transition-all duration-500 ${
                (vitals?.cpu.usagePercent || 0) > 85 ? 'bg-rose-500' : 'bg-cyan-400'
              }`}
              style={{ width: `${Math.min(100, vitals?.cpu.usagePercent || 0)}%` }}
            />
          </div>
          <div className="space-y-1.5 font-mono text-xs text-slate-400 border-t border-cyan-500/20 pt-2.5">
            <div className="flex justify-between">
              <span>Cores:</span>
              <span className="text-slate-200">{vitals?.cpu.cores || 8}</span>
            </div>
            <div className="flex justify-between">
              <span>Architecture:</span>
              <span className="text-slate-200 truncate max-w-[180px]">{vitals?.cpu.model || 'aarch64'}</span>
            </div>
            <div className="flex justify-between">
              <span>Load Average:</span>
              <span className="text-slate-200">
                {vitals?.cpu.loadAverage.map((l) => l.toFixed(2)).join(', ') || '0.00, 0.00, 0.00'}
              </span>
            </div>
          </div>
        </div>

        {/* Memory */}
        <div className="hud-card-green rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between text-slate-400 font-mono text-xs">
            <span className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              <span className="font-orbitron font-bold text-emerald-400">RAM (MEMINFO)</span>
            </span>
            <span className="font-orbitron text-base font-black text-emerald-300 text-glow-green">{vitals?.memory.usagePercent ?? 0}%</span>
          </div>
          <div className="h-2 w-full rounded bg-slate-900 overflow-hidden border border-emerald-500/20">
            <div
              className="h-full bg-emerald-400 transition-all duration-500"
              style={{ width: `${vitals?.memory.usagePercent || 0}%` }}
            />
          </div>
          <div className="space-y-1.5 font-mono text-xs text-slate-400 border-t border-emerald-500/20 pt-2.5">
            <div className="flex justify-between">
              <span>Used:</span>
              <span className="text-slate-200">{formatBytes(vitals?.memory.usedBytes || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Available:</span>
              <span className="text-slate-200">{formatBytes(vitals?.memory.availableBytes || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total RAM:</span>
              <span className="text-slate-200">{formatBytes(vitals?.memory.totalBytes || 0)}</span>
            </div>
          </div>
        </div>

        {/* Storage */}
        <div className="hud-card rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between text-slate-400 font-mono text-xs">
            <span className="flex items-center space-x-2">
              <HardDrive className="h-4 w-4 text-cyan-400" />
              <span className="font-orbitron font-bold text-cyan-400">SHARED STORAGE</span>
            </span>
            <span className="font-orbitron text-base font-black text-cyan-300 text-glow-cyan">{vitals?.storage.usedPercentage ?? 0}%</span>
          </div>
          <div className="h-2 w-full rounded bg-slate-900 overflow-hidden border border-cyan-500/20">
            <div
              className={`h-full transition-all duration-500 ${
                (vitals?.storage.usedPercentage || 0) > 90 ? 'bg-rose-500' : 'bg-cyan-400'
              }`}
              style={{ width: `${Math.min(100, vitals?.storage.usedPercentage || 0)}%` }}
            />
          </div>
          <div className="space-y-1.5 font-mono text-xs text-slate-400 border-t border-cyan-500/20 pt-2.5">
            <div className="flex justify-between">
              <span>Used:</span>
              <span className="text-slate-200">{formatBytes(vitals?.storage.usedBytes || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Free:</span>
              <span className="text-slate-200">{formatBytes(vitals?.storage.freeBytes || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Capacity:</span>
              <span className="text-slate-200">{formatBytes(vitals?.storage.totalBytes || 128 * 1024 ** 3)}</span>
            </div>
          </div>
        </div>

        {/* Network Throughput */}
        <div className="hud-card rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between text-slate-400 font-mono text-xs">
            <span className="flex items-center space-x-2">
              <Wifi className="h-4 w-4 text-cyan-400" />
              <span className="font-orbitron font-bold text-cyan-400">NETWORK I/O</span>
            </span>
            <span className="font-mono text-cyan-300">{vitals?.network.interfaceName || 'wlan0'}</span>
          </div>
          <div className="space-y-2 py-1 font-mono">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Download (RX):</span>
              <span className="text-cyan-400 font-bold">
                ↓ {formatBytes(vitals?.network.rxBytesPerSec || 0)}/s
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Upload (TX):</span>
              <span className="text-emerald-400 font-bold">
                ↑ {formatBytes(vitals?.network.txBytesPerSec || 0)}/s
              </span>
            </div>
          </div>
          <div className="space-y-1.5 font-mono text-xs text-slate-400 border-t border-cyan-500/20 pt-2.5">
            <div className="flex justify-between">
              <span>Total RX:</span>
              <span className="text-slate-200">{formatBytes(vitals?.network.totalRxBytes || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total TX:</span>
              <span className="text-slate-200">{formatBytes(vitals?.network.totalTxBytes || 0)}</span>
            </div>
          </div>
        </div>

        {/* Thermal & Battery */}
        <div className="hud-card-green rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between text-slate-400 font-mono text-xs">
            <span className="flex items-center space-x-2">
              <Thermometer className="h-4 w-4 text-amber-400" />
              <span className="font-orbitron font-bold text-amber-400">THERMAL & POWER</span>
            </span>
            <span className="font-orbitron text-base font-black text-amber-300">
              {vitals?.thermal.cpuTempCelsius ? `${vitals.thermal.cpuTempCelsius}°C` : '34°C'}
            </span>
          </div>
          <div className="space-y-1.5 font-mono text-xs text-slate-400 pt-2.5 border-t border-emerald-500/20">
            <div className="flex justify-between">
              <span>CPU Temperature:</span>
              <span className="text-amber-300 font-semibold">
                {vitals?.thermal.cpuTempCelsius ? `${vitals.thermal.cpuTempCelsius} °C` : '34 °C'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Battery Temperature:</span>
              <span className="text-slate-200">
                {vitals?.battery.temperatureCelsius ? `${vitals.battery.temperatureCelsius} °C` : '30 °C'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Battery Level:</span>
              <span className="text-emerald-400 font-bold">{vitals?.battery.level ?? 100}%</span>
            </div>
            <div className="flex justify-between">
              <span>Power Source:</span>
              <span className="text-slate-200">{vitals?.battery.isCharging ? 'CHARGING (AC/USB)' : 'BATTERY'}</span>
            </div>
          </div>
        </div>

        {/* Host & Kernel */}
        <div className="hud-card rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between text-slate-400 font-mono text-xs">
            <span className="flex items-center space-x-2">
              <Layers className="h-4 w-4 text-purple-400" />
              <span className="font-orbitron font-bold text-purple-400">RUNNING TASKS</span>
            </span>
            <span className="font-orbitron text-base font-black text-purple-300">{vitals?.processCount || 0}</span>
          </div>
          <div className="space-y-1.5 font-mono text-xs text-slate-400 pt-2.5 border-t border-cyan-500/20">
            <div className="flex justify-between">
              <span>Active PIDs:</span>
              <span className="text-slate-200">{vitals?.processCount || 0} tasks</span>
            </div>
            <div className="flex justify-between">
              <span>System Uptime:</span>
              <span className="text-slate-200">
                {vitals ? `${Math.floor(vitals.uptimeSeconds / 3600)}h ${Math.floor((vitals.uptimeSeconds % 3600) / 60)}m` : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Power Management Section */}
      <div className="rounded border border-border bg-bg-panel p-4">
        <div className="mb-3 border-b border-border pb-2">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-fg flex items-center space-x-2">
            <Power className="h-4 w-4 text-accent-red" />
            <span>Hardware Power Management</span>
          </h2>
          <p className="font-mono text-[11px] text-fg-subtle">
            Android security permits locking via Accessibility Service. Device reboot and shutdown require root permissions.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setPowerModal({ action: 'lock', title: 'LOCK PHONE SCREEN' })}
            className="flex items-center space-x-2 rounded border border-border bg-bg-base px-3 py-2 font-mono text-xs text-fg hover:border-accent-blue hover:text-accent-blue transition-colors"
          >
            <Lock className="h-3.5 w-3.5 text-accent-blue" />
            <span>Lock Screen</span>
          </button>

          <button
            onClick={() => setPowerModal({ action: 'restart', title: 'RESTART DEVICE' })}
            className="flex items-center space-x-2 rounded border border-border bg-bg-base px-3 py-2 font-mono text-xs text-fg hover:border-accent-red hover:text-accent-red transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5 text-accent-red" />
            <span>Restart (Root Required)</span>
          </button>

          <button
            onClick={() => setPowerModal({ action: 'shutdown', title: 'POWER OFF DEVICE' })}
            className="flex items-center space-x-2 rounded border border-border bg-bg-base px-3 py-2 font-mono text-xs text-fg hover:border-accent-red hover:text-accent-red transition-colors"
          >
            <Power className="h-3.5 w-3.5 text-accent-red" />
            <span>Shutdown (Root Required)</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {powerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-sm rounded border border-border bg-bg-panel p-5">
            <div className="mb-3 flex items-center space-x-2 font-mono text-xs font-semibold text-accent-red">
              <AlertTriangle className="h-4 w-4" />
              <span>CONFIRM POWER ACTION</span>
            </div>
            <p className="mb-4 font-mono text-xs text-fg-muted">
              Are you sure you want to trigger <strong>{powerModal.title}</strong>? If root is not available, the request will be rejected by Android.
            </p>
            <div className="flex justify-end space-x-2 font-mono text-xs">
              <button
                type="button"
                onClick={() => setPowerModal(null)}
                className="rounded px-3 py-1.5 text-fg-muted hover:bg-bg-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isActing}
                onClick={async () => {
                  await executePowerAction();
                  setPowerModal(null);
                }}
                className="rounded bg-accent-red px-4 py-1.5 text-white font-semibold hover:bg-red-600 disabled:opacity-50"
              >
                {isActing ? 'Executing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
