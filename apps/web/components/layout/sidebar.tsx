'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Folder,
  Terminal as TerminalIcon,
  Activity,
  Smartphone,
  Cpu,
  Users,
  Settings,
  LayoutDashboard,
  LogOut,
  Shield,
} from 'lucide-react';
import { UserProfile } from '@android-server/shared';
import { fetchApi } from '@/lib/api';

interface SidebarProps {
  user: UserProfile | null;
  isOpen: boolean;
  onClose?: () => void;
}

export function Sidebar({ user, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await fetchApi('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch {
      window.location.href = '/login';
    }
  };

  const navItems = [
    { label: 'DASHBOARD', href: '/', icon: LayoutDashboard },
    { label: 'FILES', href: '/files', icon: Folder },
    { label: 'TERMINAL', href: '/terminal', icon: TerminalIcon },
    { label: 'SYSTEM', href: '/system', icon: Cpu },
    { label: 'PHONE', href: '/phone', icon: Smartphone },
    { label: 'ACTIVITY', href: '/activity', icon: Activity },
  ];

  const adminItems = [
    { label: 'USERS', href: '/users', icon: Users },
    { label: 'SETTINGS', href: '/settings', icon: Settings },
  ];

  const isAdmin = user?.role === 'ADMIN';

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-60 flex-col border-r border-border bg-bg-panel transition-transform md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand / Header */}
        <div className="relative flex h-16 items-center justify-between border-b border-cyan-500/20 px-4 bg-black/60 backdrop-blur-md">
          <div className="flex items-center space-x-2.5">
            <div className="relative flex h-2.5 w-2.5 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </div>
            <div className="flex flex-col">
              <span className="font-orbitron text-xs font-bold tracking-widest text-cyan-400 text-glow-cyan">
                PHONE NAS
              </span>
              <span className="font-mono text-[9px] tracking-wider text-slate-400">
                ARM64 RUNTIME
              </span>
            </div>
          </div>
          <span className="rounded bg-emerald-500/10 border border-emerald-500/40 px-2 py-0.5 font-orbitron text-[9px] font-bold tracking-widest text-emerald-400">
            ONLINE
          </span>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-2 py-4 space-y-6">
          <div>
            <div className="px-3 pb-2 font-orbitron text-[10px] uppercase tracking-widest text-slate-500">
              OPERATIONS
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center space-x-3 rounded px-3 py-2 text-xs font-mono tracking-wider transition-all ${
                      isActive
                        ? 'bg-cyan-500/10 text-cyan-300 border-l-2 border-cyan-400 font-bold shadow-[inset_0_0_12px_rgba(0,240,255,0.08)]'
                        : 'text-slate-400 hover:bg-slate-900/60 hover:text-cyan-400 hover:border-l-2 hover:border-slate-600'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="font-orbitron text-[11px]">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {isAdmin && (
            <div>
              <div className="px-3 pb-2 font-orbitron text-[10px] uppercase tracking-widest text-slate-500 flex items-center justify-between">
                <span>SECURITY & ADMIN</span>
                <Shield className="h-3 w-3 text-cyan-400" />
              </div>
              <nav className="space-y-1">
                {adminItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`flex items-center space-x-3 rounded px-3 py-2 text-xs font-mono tracking-wider transition-all ${
                        isActive
                          ? 'bg-cyan-500/10 text-cyan-300 border-l-2 border-cyan-400 font-bold shadow-[inset_0_0_12px_rgba(0,240,255,0.08)]'
                          : 'text-slate-400 hover:bg-slate-900/60 hover:text-cyan-400 hover:border-l-2 hover:border-slate-600'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="font-orbitron text-[11px]">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          )}
        </div>

        {/* User Footer */}
        <div className="border-t border-cyan-500/20 p-3 bg-black/60">
          <div className="flex items-center justify-between">
            <div className="flex flex-col truncate pr-2">
              <span className="truncate font-mono text-xs text-slate-200">
                {user?.username || 'anonymous'}
              </span>
              <span className="font-orbitron text-[9px] tracking-wider text-cyan-400/80">
                ROLE: {user?.role || 'USER'}
              </span>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="rounded p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
