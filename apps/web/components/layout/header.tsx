'use client';

import React from 'react';
import { Menu, Wifi, HardDrive, ShieldAlert } from 'lucide-react';
import { DeviceCapabilities } from '@android-server/shared';

interface HeaderProps {
  onToggleMobileMenu: () => void;
  capabilities: DeviceCapabilities | null;
  hostInfo?: { ipAddress: string; model: string };
}

export function Header({ onToggleMobileMenu, capabilities, hostInfo }: HeaderProps) {
  const isCompanionConnected = capabilities?.companionConnected;

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border bg-bg-panel/90 px-4 backdrop-blur">
      <div className="flex items-center space-x-3">
        <button
          onClick={onToggleMobileMenu}
          className="rounded p-1.5 text-fg-muted hover:bg-bg-hover md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center space-x-2">
          <span className="font-mono text-xs text-fg-muted">NODE:</span>
          <span className="font-mono text-xs text-fg font-semibold">
            {hostInfo?.model || 'OPPO_CPH2219'}
          </span>
          <span className="hidden sm:inline font-mono text-xs text-fg-subtle">
            ({hostInfo?.ipAddress || '127.0.0.1'})
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* Companion Status */}
        <div className="flex items-center space-x-1.5 rounded border border-border bg-bg-base px-2 py-1 text-[11px] font-mono">
          <div
            className={`h-2 w-2 rounded-full ${
              isCompanionConnected ? 'bg-accent-green animate-pulse' : 'bg-fg-subtle'
            }`}
          />
          <span className={isCompanionConnected ? 'text-accent-green' : 'text-fg-subtle'}>
            {isCompanionConnected ? 'COMPANION LINKED' : 'STANDALONE TERMUX'}
          </span>
        </div>

        {/* Root Status Indicator */}
        <div className="hidden sm:flex items-center space-x-1 rounded border border-border bg-bg-base px-2 py-1 text-[11px] font-mono text-fg-subtle">
          <span>ROOT:</span>
          <span className={capabilities?.root === 'READY' ? 'text-accent-green' : 'text-fg-subtle'}>
            {capabilities?.root === 'READY' ? 'ACTIVE' : 'UNAVAILABLE'}
          </span>
        </div>
      </div>
    </header>
  );
}
