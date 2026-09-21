'use client';

import React from 'react';
import { Menu, Wifi } from 'lucide-react';

interface HeaderProps {
  onToggleMobileMenu: () => void;
  hostInfo?: { ipAddress: string; model: string };
}

export function Header({ onToggleMobileMenu, hostInfo }: HeaderProps) {
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
          <span className="font-mono text-xs text-fg-muted">HOST:</span>
          <span className="font-mono text-xs text-fg font-semibold">
            {hostInfo?.model || 'Android Phone'}
          </span>
          <span className="hidden sm:inline font-mono text-xs text-accent-blue font-medium bg-accent-blue/10 px-1.5 py-0.5 rounded border border-accent-blue/20">
            {hostInfo?.ipAddress || '192.168.43.1'}
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-1.5 rounded border border-border bg-bg-base px-2 py-1 text-[11px] font-mono">
          <Wifi className="h-3 w-3 text-accent-green" />
          <span className="text-accent-green">
            TERMUX NAS ACTIVE
          </span>
        </div>
      </div>
    </header>
  );
}
