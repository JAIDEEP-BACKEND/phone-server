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

    // Fetch initial vitals & recent logs
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
  const memUsedGb = vitals ? (vitals.memory.usedBytes / (1024 ** 3)).toFixed(1) : '0';
  const memTotalGb = vitals ? (vitals.memory.totalBytes / (1024 ** 3)).toFixed(1) : '0';
  const storageUsedGb = vitals ? (vitals.storage.usedBytes / (1024 ** 3)).toFixed(1) : '0';
  const storageTotalGb = vitals ? (vitals.storage.totalBytes / (1024 ** 3)).toFixed(1) : '128';

  return (
    <div className="space-y-6">
      {/* Top Telemetry Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* CPU */}
        <div className="rounded border border-border bg-bg-panel p-3">
          <div className="flex items-center justify-between text-fg-subtle">
            <span className="font-mono text-[10px] uppercase">CPU LOAD</span>
            <Cpu className="h-3.5 w-3.5 text-accent-blue" />
          </div>
          <div className="mt-2 font-mono text-xl font-semibold text-fg">
            {cpuPercent}%
          </div>
          <div className="mt-1 h-1 w-full rounded bg-bg-base overflow-hidden">
            <div
              className={`h-full ${cpuPercent > 80 ? 'bg-accent-red' : 'bg-accent-blue'}`}
              style={{ width: `${Math.min(100, cpuPercent)}%` }}
            />
          </div>
        </div>

        {/* Memory */}
        <div className="rounded border border-border bg-bg-panel p-3">
          <div className="flex items-center justify-between text-fg-subtle">
            <span className="font-mono text-[10px] uppercase">MEMORY</span>
            <Activity className="h-3.5 w-3.5 text-accent-green" />
          </div>
          <div className="mt-2 font-mono text-xl font-semibold text-fg truncate">
            {memUsedGb} <span className="text-xs text-fg-muted">/ {memTotalGb} GB</span>
          </div>
          <div className="mt-1 h-1 w-full rounded bg-bg-base overflow-hidden">
            <div
              className="h-full bg-accent-green"
              style={{ width: `${vitals?.memory.usagePercent || 0}%` }}
            />
          </div>
        </div>

        {/* Storage */}
        <div className="rounded border border-border bg-bg-panel p-3">
          <div className="flex items-center justify-between text-fg-subtle">
            <span className="font-mono text-[10px] uppercase">STORAGE</span>
            <HardDrive className="h-3.5 w-3.5 text-accent-blue" />
          </div>
          <div className="mt-2 font-mono text-xl font-semibold text-fg truncate">
            {storageUsedGb} <span className="text-xs text-fg-muted">/ {storageTotalGb} GB</span>
          </div>
          <div className="mt-1 h-1 w-full rounded bg-bg-base overflow-hidden">
            <div
              className="h-full bg-accent-blue"
              style={{ width: `${vitals?.storage.usedPercentage || 0}%` }}
            />
          </div>
        </div>

        {/* Battery */}
        <div className="rounded border border-border bg-bg-panel p-3">
          <div className="flex items-center justify-between text-fg-subtle">
            <span className="font-mono text-[10px] uppercase">BATTERY</span>
            <Battery className="h-3.5 w-3.5 text-accent-green" />
          </div>
          <div className="mt-2 font-mono text-xl font-semibold text-fg">
            {vitals?.battery.level ?? 100}%
          </div>
          <div className="mt-1 font-mono text-[10px] text-fg-muted truncate">
            {vitals?.battery.isCharging ? 'CHARGING' : vitals?.battery.status || 'DISCHARGING'}
          </div>
        </div>

        {/* Network */}
        <div className="rounded border border-border bg-bg-panel p-3">
          <div className="flex items-center justify-between text-fg-subtle">
            <span className="font-mono text-[10px] uppercase">NETWORK</span>
            <Wifi className="h-3.5 w-3.5 text-accent-blue" />
          </div>
          <div className="mt-2 font-mono text-xs text-fg">
            ↓ {formatBytes(vitals?.network.rxBytesPerSec || 0)}/s
          </div>
          <div className="font-mono text-xs text-fg-muted">
            ↑ {formatBytes(vitals?.network.txBytesPerSec || 0)}/s
          </div>
        </div>

        {/* Uptime */}
        <div className="rounded border border-border bg-bg-panel p-3">
          <div className="flex items-center justify-between text-fg-subtle">
            <span className="font-mono text-[10px] uppercase">UPTIME</span>
            <Clock className="h-3.5 w-3.5 text-fg-muted" />
          </div>
          <div className="mt-2 font-mono text-xl font-semibold text-fg truncate">
            {vitals ? formatUptime(vitals.uptimeSeconds) : '0m'}
          </div>
          <div className="mt-1 flex items-center space-x-1 font-mono text-[10px] text-accent-green">
            <CheckCircle2 className="h-2.5 w-2.5" />
            <span>ONLINE</span>
          </div>
        </div>
      </div>

      {/* Quick Launch Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link
          href="/files"
          className="group flex items-center justify-between rounded border border-border bg-bg-panel p-4 hover:border-accent-blue transition-colors"
        >
          <div className="flex items-center space-x-3">
            <div className="rounded border border-border bg-bg-base p-2 text-accent-blue">
              <Folder className="h-5 w-5" />
            </div>
            <div>
              <div className="font-mono text-xs font-semibold text-fg group-hover:text-accent-blue">
                STORAGE & NAS
              </div>
              <div className="font-mono text-[11px] text-fg-muted">
                Browse /storage/emulated/0
              </div>
            </div>
          </div>
          <ArrowUpRight className="h-4 w-4 text-fg-subtle group-hover:text-accent-blue" />
        </Link>

        <Link
          href="/terminal"
          className="group flex items-center justify-between rounded border border-border bg-bg-panel p-4 hover:border-accent-blue transition-colors"
        >
          <div className="flex items-center space-x-3">
            <div className="rounded border border-border bg-bg-base p-2 text-accent-green">
              <Terminal className="h-5 w-5" />
            </div>
            <div>
              <div className="font-mono text-xs font-semibold text-fg group-hover:text-accent-green">
                TERMUX SHELL
              </div>
              <div className="font-mono text-[11px] text-fg-muted">
                Interactive PTY console
              </div>
            </div>
          </div>
          <ArrowUpRight className="h-4 w-4 text-fg-subtle group-hover:text-accent-green" />
        </Link>

        <Link
          href="/remote"
          className="group flex items-center justify-between rounded border border-border bg-bg-panel p-4 hover:border-accent-blue transition-colors"
        >
          <div className="flex items-center space-x-3">
            <div className="rounded border border-border bg-bg-base p-2 text-accent-blue">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <div className="font-mono text-xs font-semibold text-fg group-hover:text-accent-blue">
                REMOTE CONTROL
              </div>
              <div className="font-mono text-[11px] text-fg-muted">
                Screen & gesture stream
              </div>
            </div>
          </div>
          <ArrowUpRight className="h-4 w-4 text-fg-subtle group-hover:text-accent-blue" />
        </Link>
      </div>

      {/* Recent Activity Section */}
      <div className="rounded border border-border bg-bg-panel">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center space-x-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-green" />
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-fg">
              Real-Time Activity Stream
            </span>
          </div>
          <Link
            href="/activity"
            className="font-mono text-xs text-accent-blue hover:underline"
          >
            VIEW ALL LOGS →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full tech-table">
            <thead>
              <tr>
                <th>TIME</th>
                <th>USER</th>
                <th>ACTION</th>
                <th>TARGET</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center font-mono text-xs text-fg-subtle">
                    No recent activity recorded.
                  </td>
                </tr>
              ) : (
                recentLogs.map((log) => {
                  const isSuccess = log.status === 'SUCCESS';
                  return (
                    <tr key={log.id}>
                      <td className="font-mono text-xs text-fg-muted whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="font-mono text-xs text-fg">{log.username}</td>
                      <td className="font-mono text-xs text-accent-blue">{log.action}</td>
                      <td className="font-mono text-xs text-fg-muted truncate max-w-xs" title={log.target}>
                        {log.target}
                      </td>
                      <td>
                        <span
                          className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${
                            isSuccess
                              ? 'text-accent-green bg-accent-green-subtle'
                              : 'text-accent-red bg-accent-red-subtle'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
