'use client';

import React, { useState, useEffect } from 'react';
import { Activity, Search, RefreshCw, Filter } from 'lucide-react';
import { AuditLogEntry, SOCKET_EVENTS } from '@android-server/shared';
import { getSocket } from '@/lib/socket';
import { fetchApi } from '@/lib/api';

export default function ActivityPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await fetchApi('/api/logs?limit=250');
      setLogs(data.logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    loadLogs();

    const socket = getSocket();
    const handleNewEvent = (entry: AuditLogEntry) => {
      if (isMounted) {
        setLogs((prev) => [entry, ...prev]);
      }
    };

    socket.on(SOCKET_EVENTS.ACTIVITY_EVENT, handleNewEvent);

    return () => {
      isMounted = false;
      socket.off(SOCKET_EVENTS.ACTIVITY_EVENT, handleNewEvent);
    };
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesFilter = filterAction === 'ALL' || log.action.includes(filterAction);
    const matchesSearch =
      log.target.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-3">
        <div>
          <h1 className="font-mono text-sm font-semibold uppercase tracking-wider text-fg flex items-center space-x-2">
            <Activity className="h-4 w-4 text-accent-green" />
            <span>Real-Time Audit Stream</span>
          </h1>
          <p className="font-mono text-xs text-fg-muted">
            Live security event stream broadcast over WebSockets and persisted to SQLite
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Action Filter */}
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="rounded border border-border bg-bg-panel px-2.5 py-1 font-mono text-xs text-fg outline-none focus:border-accent-blue"
          >
            <option value="ALL">ALL ACTIONS</option>
            <option value="AUTH">AUTH & LOGIN</option>
            <option value="FILE">FILE OPS</option>
            <option value="SHELL">TERMINAL</option>
            <option value="REMOTE">REMOTE SESSIONS</option>
            <option value="POWER">POWER</option>
            <option value="USER">USER MGMT</option>
          </select>

          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-fg-subtle" />
            <input
              type="text"
              placeholder="Filter by user or target..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-40 sm:w-56 rounded border border-border bg-bg-panel pl-8 pr-3 py-1 font-mono text-xs text-fg outline-none focus:border-accent-blue"
            />
          </div>

          <button
            onClick={loadLogs}
            title="Refresh logs"
            className="rounded border border-border bg-bg-panel p-1.5 text-fg-muted hover:bg-bg-hover transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded border border-border bg-bg-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full tech-table">
            <thead>
              <tr>
                <th>TIME</th>
                <th>USER</th>
                <th>ACTION</th>
                <th>TARGET</th>
                <th>IP ORIGIN</th>
                <th className="text-right">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center font-mono text-xs text-fg-muted">
                    CONNECTING TO AUDIT STREAM...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center font-mono text-xs text-fg-subtle">
                    No matching audit events found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isSuccess = log.status === 'SUCCESS';
                  return (
                    <tr key={log.id}>
                      <td className="font-mono text-xs text-fg-muted whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="font-mono text-xs text-fg">{log.username}</td>
                      <td className="font-mono text-xs text-accent-blue font-semibold">
                        {log.action}
                      </td>
                      <td className="font-mono text-xs text-fg-muted truncate max-w-xs" title={log.target}>
                        {log.target}
                      </td>
                      <td className="font-mono text-xs text-fg-subtle">{log.ipAddress || '—'}</td>
                      <td className="text-right">
                        <span
                          className={`font-mono text-[11px] px-1.5 py-0.5 rounded font-semibold ${
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
