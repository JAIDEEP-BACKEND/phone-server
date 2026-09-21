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
        <div className="flex h-16 items-center justify-between border-b border-border/80 px-4 bg-bg-base/40 backdrop-blur-md">
          <div className="flex items-center space-x-2.5">
            <div className="relative flex h-2.5 w-2.5 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-green opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-green" />
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-xs font-bold tracking-wider text-fg">
                PHONE NAS
              </span>
              <span className="font-mono text-[9px] text-fg-subtle">
                ARM64 PERSONAL SERVER
              </span>
            </div>
          </div>
          <span className="rounded-full bg-accent-green/10 border border-accent-green/30 px-2 py-0.5 font-mono text-[10px] font-medium text-accent-green">
            LIVE
          </span>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-2 py-4 space-y-6">
          <div>
            <div className="px-3 pb-2 font-mono text-[11px] uppercase tracking-wider text-fg-subtle">
              Operations
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
                    className={`flex items-center space-x-3 rounded px-3 py-2 text-xs font-mono transition-colors ${
                      isActive
                        ? 'bg-accent-blue-subtle text-accent-blue border-l-2 border-accent-blue font-medium'
                        : 'text-fg-muted hover:bg-bg-hover hover:text-fg'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {isAdmin && (
            <div>
              <div className="px-3 pb-2 font-mono text-[11px] uppercase tracking-wider text-fg-subtle flex items-center justify-between">
                <span>Administration</span>
                <Shield className="h-3 w-3 text-accent-blue" />
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
                      className={`flex items-center space-x-3 rounded px-3 py-2 text-xs font-mono transition-colors ${
                        isActive
                          ? 'bg-accent-blue-subtle text-accent-blue border-l-2 border-accent-blue font-medium'
                          : 'text-fg-muted hover:bg-bg-hover hover:text-fg'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          )}
        </div>

        {/* User Footer */}
        <div className="border-t border-border p-3 bg-bg-subtle">
          <div className="flex items-center justify-between">
            <div className="flex flex-col truncate pr-2">
              <span className="truncate font-mono text-xs text-fg">
                {user?.username || 'anonymous'}
              </span>
              <span className="font-mono text-[10px] text-fg-subtle">
                ROLE: {user?.role || 'USER'}
              </span>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="rounded p-1.5 text-fg-muted hover:bg-bg-hover hover:text-accent-red transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
