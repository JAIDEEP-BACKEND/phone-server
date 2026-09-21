'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { fetchApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { UserProfile, DeviceCapabilities, SOCKET_EVENTS } from '@android-server/shared';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [capabilities, setCapabilities] = useState<DeviceCapabilities | null>(null);
  const [hostInfo, setHostInfo] = useState<{ ipAddress: string; model: string }>({
    ipAddress: '127.0.0.1',
    model: 'OPPO',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      try {
        const data = await fetchApi('/api/auth/status');
        if (!data.hasAdmin) {
          router.replace('/login');
          return;
        }

        if (!data.authenticated || !data.user) {
          router.replace('/login');
          return;
        }

        if (isMounted) {
          setUser(data.user);
          setIsLoading(false);
        }

        // Fetch capability and phone info
        try {
          const [caps, phone] = await Promise.all([
            fetchApi('/api/system/capabilities'),
            fetchApi('/api/phone/info'),
          ]);
          if (isMounted) {
            setCapabilities(caps);
            setHostInfo({
              ipAddress: phone.ipAddress,
              model: `${phone.manufacturer} ${phone.model}`,
            });
          }
        } catch {}
      } catch (err) {
        router.replace('/login');
      }
    }

    checkAuth();

    // Listen for live capability changes
    const socket = getSocket();
    const handleCaps = (caps: DeviceCapabilities) => {
      if (isMounted) setCapabilities(caps);
    };

    socket.on(SOCKET_EVENTS.DEVICE_CAPABILITIES, handleCaps);

    return () => {
      isMounted = false;
      socket.off(SOCKET_EVENTS.DEVICE_CAPABILITIES, handleCaps);
    };
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-bg-base">
        <div className="flex flex-col items-center space-y-3 font-mono text-xs text-fg-muted">
          <div className="h-4 w-4 animate-spin border-2 border-border border-t-accent-blue rounded-full" />
          <span>INITIALIZING CONSOLE...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-bg-base">
      <Sidebar
        user={user}
        isOpen={isMobileOpen}
        onClose={() => setIsMobileOpen(false)}
      />

      <div className="flex flex-1 flex-col md:pl-60">
        <Header
          onToggleMobileMenu={() => setIsMobileOpen((prev) => !prev)}
          capabilities={capabilities}
          hostInfo={hostInfo}
        />
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
