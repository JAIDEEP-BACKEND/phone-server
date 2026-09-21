'use client';

import React from 'react';
import { Menu, Wifi } from 'lucide-react';

interface HeaderProps {
  onToggleMobileMenu: () => void;
  hostInfo?: { ipAddress: string; model: string };
}

export function Header({ onToggleMobileMenu, hostInfo }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-cyan-500/20 bg-black/70 px-4 backdrop-blur-md">
      <div className="flex items-center space-x-3">
        <button
          onClick={onToggleMobileMenu}
          className="rounded p-1.5 text-slate-400 hover:bg-cyan-500/10 hover:text-cyan-400 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center space-x-2">
          <span className="font-orbitron text-[10px] tracking-wider text-slate-500">SYS_HOST:</span>
          <span className="font-mono text-xs text-cyan-300 font-semibold">
            {hostInfo?.model || 'Android Phone'}
          </span>
          <span className="hidden sm:inline font-mono text-xs text-cyan-400 font-medium bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
            {hostInfo?.ipAddress || '192.168.43.1'}
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 rounded border border-emerald-500/30 bg-emerald-950/20 px-2.5 py-1 text-[11px] font-mono">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-orbitron text-[10px] font-bold tracking-wider text-emerald-400">
            TERMUX NAS ACTIVE
          </span>
        </div>
      </div>
    </header>
  );
}
