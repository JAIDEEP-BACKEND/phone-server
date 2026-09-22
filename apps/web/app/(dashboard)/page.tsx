'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Cpu,
  HardDrive,
  Activity,
  Battery,
  Wifi,
  Clock,
  CheckCircle2,
  Folder,
  Terminal,
  Smartphone,
  ArrowUpRight,
  Thermometer,
  ShieldCheck,
  Zap,
  Radio,
} from 'lucide-react';
import { SystemVitals, AuditLogEntry, SOCKET_EVENTS } from '@android-server/shared';
import { getSocket } from '@/lib/socket';
import { fetchApi } from '@/lib/api';

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0 || d > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

export default function DashboardPage() {
  const [vitals, setVitals] = useState<SystemVitals | null>(null);
  const [recentLogs, setRecentLogs] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    let isMounted = true;

    // Initial fetch
    Promise.all([
      fetchApi('/api/system/stats').catch(() => null),
      fetchApi('/api/logs?limit=10').catch(() => ({ logs: [] })),
    ]).then(([v, l]) => {
      if (isMounted) {
        if (v) setVitals(v);
        if (l?.logs) setRecentLogs(l.logs);
      }
    });

    const socket = getSocket();
    socket.emit(SOCKET_EVENTS.SYSTEM_STATS_SUBSCRIBE);

    const handleVitals = (data: SystemVitals) => {
      if (isMounted) setVitals(data);
    };

    const handleActivity = (entry: AuditLogEntry) => {
      if (isMounted) {
        setRecentLogs((prev) => [entry, ...prev.slice(0, 9)]);
      }
    };

    socket.on(SOCKET_EVENTS.SYSTEM_STATS, handleVitals);
    socket.on(SOCKET_EVENTS.ACTIVITY_EVENT, handleActivity);

    return () => {
      isMounted = false;
      socket.emit(SOCKET_EVENTS.SYSTEM_STATS_UNSUBSCRIBE);
      socket.off(SOCKET_EVENTS.SYSTEM_STATS, handleVitals);
      socket.off(SOCKET_EVENTS.ACTIVITY_EVENT, handleActivity);
    };
  }, []);

  const cpuPercent = vitals?.cpu.usagePercent ?? 0;
  const memUsedGb = vitals ? (vitals.memory.usedBytes / 1024 ** 3).toFixed(1) : '0';
  const memTotalGb = vitals ? (vitals.memory.totalBytes / 1024 ** 3).toFixed(1) : '0';
  const storageUsedGb = vitals ? (vitals.storage.usedBytes / 1024 ** 3).toFixed(1) : '0';
  const storageTotalGb = vitals ? (vitals.storage.totalBytes / 1024 ** 3).toFixed(1) : '128';
  const cpuTemp = vitals?.thermal?.cpuTempCelsius ?? 34.5;

  return (
    <div className="space-y-6">
      {/* Live Status Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-accent-blue/15 via-purple-500/10 to-transparent p-6 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <h1 className="font-mono text-sm font-bold uppercase tracking-wider text-fg">
                PHONE NAS PERSONAL SERVER
              </h1>
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-400">
                1Hz TELEMETRY LIVE
              </span>
            </div>
            <p className="font-mono text-xs text-fg-muted">
              Self-hosted private storage, interactive terminal, and real-time hardware telemetry.
            </p>
          </div>

          <div className="flex items-center space-x-2 font-mono text-xs text-fg-muted bg-black/40 border border-white/10 rounded-xl px-3 py-2 shrink-0">
            <Radio className="h-3.5 w-3.5 text-accent-blue animate-pulse" />
            <span>Hotspot IP:</span>
            <span className="text-accent-blue font-bold">
              {typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
                ? `${window.location.hostname}:3001`
                : '10.78.153.85:3001'}
            </span>
          </div>
        </div>
      </div>

      {/* Primary Telemetry Grid */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
        {/* CPU Load */}
        <div className="hud-card rounded-xl p-4 transition-all hover:border-cyan-400/50">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-orbitron text-[10px] uppercase font-bold tracking-wider text-cyan-400">CPU LOAD</span>
            <Cpu className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2.5 font-orbitron text-2xl font-black text-cyan-300 text-glow-cyan">
            {cpuPercent}%
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-slate-900 border border-cyan-500/20 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                cpuPercent > 75
                  ? 'bg-rose-500'
                  : cpuPercent > 45
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.max(4, Math.min(100, cpuPercent))}%` }}
            />
          </div>
          <div className="mt-1.5 font-mono text-[10px] text-slate-400">
            {vitals?.cpu?.cores || 8} Active Cores
          </div>
        </div>

        {/* Memory */}
        <div className="hud-card-green rounded-xl p-4 transition-all hover:border-emerald-400/50">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-orbitron text-[10px] uppercase font-bold tracking-wider text-emerald-400">RAM MEMORY</span>
            <Activity className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2.5 font-orbitron text-2xl font-black text-emerald-300 text-glow-green truncate">
            {memUsedGb} <span className="text-xs font-normal text-slate-400">/ {memTotalGb} GB</span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-slate-900 border border-emerald-500/20 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-500"
              style={{ width: `${vitals?.memory?.usagePercent || 0}%` }}
            />
          </div>
          <div className="mt-1.5 font-mono text-[10px] text-slate-400">
            {vitals?.memory?.usagePercent || 0}% Allocated
          </div>
        </div>

        {/* Storage */}
        <div className="hud-card rounded-xl p-4 transition-all hover:border-cyan-400/50">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-orbitron text-[10px] uppercase font-bold tracking-wider text-cyan-400">STORAGE</span>
            <HardDrive className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2.5 font-orbitron text-2xl font-black text-cyan-300 text-glow-cyan truncate">
            {storageUsedGb} <span className="text-xs font-normal text-slate-400">/ {storageTotalGb} GB</span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-slate-900 border border-cyan-500/20 overflow-hidden">
            <div
              className="h-full bg-cyan-400 transition-all duration-500"
              style={{ width: `${vitals?.storage?.usedPercentage || 0}%` }}
            />
          </div>
          <div className="mt-1.5 font-mono text-[10px] text-slate-400">
            {vitals?.storage?.usedPercentage || 0}% In Use
          </div>
        </div>

        {/* Temperature */}
        <div className="hud-card rounded-xl p-4 transition-all hover:border-amber-400/50">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-orbitron text-[10px] uppercase font-bold tracking-wider text-amber-400">THERMAL</span>
            <Thermometer className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2.5 font-orbitron text-2xl font-black text-amber-300">
            {cpuTemp}°C
          </div>
          <div className="mt-2 flex items-center space-x-1 font-mono text-[10px]">
            <span
              className={`h-2 w-2 rounded-full ${
                cpuTemp > 45 ? 'bg-rose-500' : cpuTemp > 38 ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
            />
            <span className="text-slate-400">
              {cpuTemp > 45 ? 'High Load' : cpuTemp > 38 ? 'Moderate' : 'Optimal'}
            </span>
          </div>
          <div className="mt-1.5 font-mono text-[10px] text-slate-400">
            Hardware Sensor
          </div>
        </div>

        {/* Battery */}
        <div className="hud-card-green rounded-xl p-4 transition-all hover:border-emerald-400/50">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-orbitron text-[10px] uppercase font-bold tracking-wider text-emerald-400">BATTERY</span>
            <Battery className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2.5 font-orbitron text-2xl font-black text-emerald-300 text-glow-green">
            {vitals?.battery?.level ?? 100}%
          </div>
          <div className="mt-2 flex items-center space-x-1 font-mono text-[10px] text-slate-400">
            <Zap className="h-3 w-3 text-amber-400" />
            <span className="truncate">
              {vitals?.battery?.isCharging ? 'Charging' : vitals?.battery?.status || 'Active'}
            </span>
          </div>
          <div className="mt-1.5 font-mono text-[10px] text-slate-400">
            Wake Lock On
          </div>
        </div>

        {/* Network & Uptime */}
        <div className="hud-card rounded-xl p-4 transition-all hover:border-cyan-400/50">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-orbitron text-[10px] uppercase font-bold tracking-wider text-cyan-400">UPTIME</span>
            <Clock className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2.5 font-orbitron text-xl font-black text-cyan-300 truncate">
            {vitals ? formatUptime(vitals.uptimeSeconds) : '0m'}
          </div>
          <div className="mt-2 font-mono text-[11px] text-slate-400">
            ↓ {formatBytes(vitals?.network?.rxBytesPerSec || 0)}/s
          </div>
          <div className="font-mono text-[10px] text-slate-500">
            ↑ {formatBytes(vitals?.network?.txBytesPerSec || 0)}/s
          </div>
        </div>
      </div>

      {/* Quick Launch Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/files"
          className="group flex items-center justify-between hud-card rounded-xl p-5 hover:border-cyan-400 hover:shadow-[0_0_20px_rgba(0,240,255,0.15)] transition-all"
        >
          <div className="flex items-center space-x-4">
            <div className="rounded-lg border border-cyan-500/40 bg-cyan-950/30 p-3 text-cyan-400 group-hover:scale-105 transition-transform">
              <Folder className="h-6 w-6" />
            </div>
            <div>
              <div className="font-orbitron text-xs font-bold tracking-wider text-slate-200 group-hover:text-cyan-300">
                FILES & STORAGE NAS
              </div>
              <div className="font-mono text-[11px] text-slate-400">
                Browse, upload, download, and manage storage
              </div>
            </div>
          </div>
          <ArrowUpRight className="h-4 w-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
        </Link>

        <Link
          href="/terminal"
          className="group flex items-center justify-between hud-card-green rounded-xl p-5 hover:border-emerald-400 hover:shadow-[0_0_20px_rgba(0,255,136,0.15)] transition-all"
        >
          <div className="flex items-center space-x-4">
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-3 text-emerald-400 group-hover:scale-105 transition-transform">
              <Terminal className="h-6 w-6" />
            </div>
            <div>
              <div className="font-orbitron text-xs font-bold tracking-wider text-slate-200 group-hover:text-emerald-300">
                WEB TERMINAL
              </div>
              <div className="font-mono text-[11px] text-slate-400">
                Interactive Termux shell & command line
              </div>
            </div>
          </div>
          <ArrowUpRight className="h-4 w-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
        </Link>

        <Link
          href="/system"
          className="group flex items-center justify-between hud-card rounded-xl p-5 hover:border-purple-400 hover:shadow-[0_0_20px_rgba(168,85,247,0.15)] transition-all sm:col-span-2 lg:col-span-1"
        >
          <div className="flex items-center space-x-4">
            <div className="rounded-lg border border-purple-500/40 bg-purple-950/30 p-3 text-purple-400 group-hover:scale-105 transition-transform">
              <Smartphone className="h-6 w-6" />
            </div>
            <div>
              <div className="font-orbitron text-xs font-bold tracking-wider text-slate-200 group-hover:text-purple-300">
                HARDWARE & ENVIRONMENT
              </div>
              <div className="font-mono text-[11px] text-slate-400">
                Battery health, memory breakdown & sensors
              </div>
            </div>
          </div>
          <ArrowUpRight className="h-4 w-4 text-slate-500 group-hover:text-purple-400 transition-colors" />
        </Link>
      </div>

      {/* Live System Activity Feed */}
      <div className="hud-card rounded-xl p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
          <div className="flex items-center space-x-2">
            <Activity className="h-4 w-4 text-cyan-400" />
            <h2 className="font-orbitron text-xs font-bold uppercase tracking-widest text-cyan-300">
              LIVE SYSTEM ACTIVITY LOGS
            </h2>
          </div>
          <Link
            href="/activity"
            className="font-orbitron text-xs text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
          >
            <span>VIEW ALL</span>
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        {recentLogs.length === 0 ? (
          <div className="py-8 text-center font-mono text-xs text-slate-500">
            Listening for system operations and security events...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full tech-table font-mono text-xs">
              <thead>
                <tr>
                  <th>TIMESTAMP</th>
                  <th>ACTION</th>
                  <th>TARGET</th>
                  <th>USER</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-cyan-500/5 transition-colors">
                    <td className="text-slate-400 text-[11px]">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="font-semibold text-slate-200">
                      <span className="rounded bg-cyan-950/40 px-2 py-0.5 text-[10px] font-orbitron text-cyan-400 border border-cyan-500/30">
                        {log.action}
                      </span>
                    </td>
                    <td className="text-slate-300 truncate max-w-[200px]">
                      {log.target}
                    </td>
                    <td className="text-slate-400">
                      {log.username}
                    </td>
                    <td>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-orbitron font-semibold ${
                          log.status === 'SUCCESS'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
