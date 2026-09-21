'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Save, ShieldAlert, Wifi, HardDrive, Smartphone, Check } from 'lucide-react';
import { fetchApi } from '@/lib/api';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({
    serverPort: '3001',
    storageRoot: '/storage/emulated/0',
    maxUploadSizeMb: '2048',
    sessionTtlHours: '24',
    deviceName: 'OPPO Android Server',
    rateLimitAttempts: '5',
  });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchApi('/api/settings')
      .then((res) => {
        if (res.settings) setSettings((prev) => ({ ...prev, ...res.settings }));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);

    try {
      await fetchApi('/api/settings', {
        method: 'POST',
        body: JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update settings.');
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="border-b border-border pb-3">
        <h1 className="font-mono text-sm font-semibold uppercase tracking-wider text-fg flex items-center space-x-2">
          <Settings className="h-4 w-4 text-accent-blue" />
          <span>Server Configuration & Network Parameters</span>
        </h1>
        <p className="font-mono text-xs text-fg-muted">
          Operational boundaries, storage path roots, and companion pairing parameters
        </p>
      </div>

      {saved && (
        <div className="flex items-center space-x-2 rounded border border-accent-green/50 bg-accent-green-subtle p-3 font-mono text-xs text-accent-green">
          <Check className="h-4 w-4" />
          <span>Settings successfully updated in SQLite database.</span>
        </div>
      )}

      {error && (
        <div className="rounded border border-accent-red/50 bg-accent-red-subtle p-3 font-mono text-xs text-accent-red">
          [ERROR] {error}
        </div>
      )}

      {/* Network Warning Banner */}
      <div className="rounded border border-border bg-bg-panel p-4 space-y-2">
        <div className="flex items-center space-x-2 font-mono text-xs font-semibold text-accent-blue">
          <Wifi className="h-4 w-4" />
          <span>NETWORK BINDING: 0.0.0.0 (LAN ACCESSIBLE)</span>
        </div>
        <p className="font-mono text-xs text-fg-muted leading-relaxed">
          The server daemon listens on all interfaces (<code>0.0.0.0</code>). Any computer, tablet, or phone on the same Wi-Fi or LAN subnet can connect.
          Ensure strong passwords for all accounts and do not expose port directly to the public internet without a reverse proxy or VPN.
        </p>
      </div>

      {/* Settings Form */}
      <form onSubmit={handleSave} className="rounded border border-border bg-bg-panel p-5 space-y-4 font-mono text-xs">
        <div className="space-y-1">
          <label className="text-fg font-semibold">Device Display Name</label>
          <input
            type="text"
            value={settings.deviceName || ''}
            onChange={(e) => setSettings({ ...settings, deviceName: e.target.value })}
            className="w-full rounded border border-border bg-bg-base px-3 py-2 text-fg outline-none focus:border-accent-blue"
          />
        </div>

        <div className="space-y-1">
          <label className="text-fg font-semibold">Primary Storage Root Path</label>
          <input
            type="text"
            value={settings.storageRoot || ''}
            onChange={(e) => setSettings({ ...settings, storageRoot: e.target.value })}
            className="w-full rounded border border-border bg-bg-base px-3 py-2 text-fg outline-none focus:border-accent-blue"
          />
          <div className="text-[11px] text-fg-subtle">
            Android standard shared storage: <code>/storage/emulated/0</code>.
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-fg font-semibold">Backend HTTP Port</label>
            <input
              type="number"
              value={settings.serverPort || '3001'}
              onChange={(e) => setSettings({ ...settings, serverPort: e.target.value })}
              className="w-full rounded border border-border bg-bg-base px-3 py-2 text-fg outline-none focus:border-accent-blue"
            />
          </div>

          <div className="space-y-1">
            <label className="text-fg font-semibold">Max Upload Size (MB)</label>
            <input
              type="number"
              value={settings.maxUploadSizeMb || '2048'}
              onChange={(e) => setSettings({ ...settings, maxUploadSizeMb: e.target.value })}
              className="w-full rounded border border-border bg-bg-base px-3 py-2 text-fg outline-none focus:border-accent-blue"
            />
          </div>

          <div className="space-y-1">
            <label className="text-fg font-semibold">Session Lifetime (Hours)</label>
            <input
              type="number"
              value={settings.sessionTtlHours || '24'}
              onChange={(e) => setSettings({ ...settings, sessionTtlHours: e.target.value })}
              className="w-full rounded border border-border bg-bg-base px-3 py-2 text-fg outline-none focus:border-accent-blue"
            />
          </div>

          <div className="space-y-1">
            <label className="text-fg font-semibold">Rate Limit Max Attempts</label>
            <input
              type="number"
              value={settings.rateLimitAttempts || '5'}
              onChange={(e) => setSettings({ ...settings, rateLimitAttempts: e.target.value })}
              className="w-full rounded border border-border bg-bg-base px-3 py-2 text-fg outline-none focus:border-accent-blue"
            />
          </div>
        </div>

        <div className="flex justify-end pt-3">
          <button
            type="submit"
            className="flex items-center space-x-1.5 rounded bg-accent-blue px-4 py-2 font-mono text-xs font-semibold text-white hover:bg-blue-600 transition-colors"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save Configuration</span>
          </button>
        </div>
      </form>

      {/* Android Companion Setup Guide */}
      <div className="rounded border border-border bg-bg-panel p-5 space-y-3 font-mono text-xs">
        <div className="flex items-center space-x-2 font-semibold text-fg">
          <Smartphone className="h-4 w-4 text-accent-green" />
          <span>Android Companion Setup Protocol</span>
        </div>

        <p className="text-fg-muted leading-relaxed">
          The companion app enables MediaProjection screen streaming, Accessibility touch dispatching, and hardware key controls:
        </p>

        <ol className="list-decimal list-inside space-y-1.5 text-fg-subtle">
          <li>Install the companion APK from <code>apps/android/app/build/outputs/apk/debug/app-debug.apk</code>.</li>
          <li>Launch the companion application on your phone.</li>
          <li>Tap <strong>Grant Screen Capture</strong> and accept the system prompt.</li>
          <li>Tap <strong>Enable Accessibility Service</strong> and toggle <em>OPPO Remote Control Service</em> to ON.</li>
          <li>Tap <strong>Grant Storage Access</strong> to enable shared media traversal.</li>
          <li>The status badge on the top header will switch to <span className="text-accent-green">COMPANION LINKED</span>.</li>
        </ol>
      </div>
    </div>
  );
}
