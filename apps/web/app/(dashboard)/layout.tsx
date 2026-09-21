'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { fetchApi } from '@/lib/api';
import { UserProfile } from '@android-server/shared';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [hostInfo, setHostInfo] = useState<{ ipAddress: string; model: string }>({
    ipAddress: '192.168.43.1',
    model: 'Android Phone',
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

        try {
          const phone = await fetchApi('/api/phone/info');
          if (isMounted) {
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

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-bg-base">
        <div className="flex flex-col items-center space-y-3 font-mono text-xs text-fg-muted">
          <div className="h-4 w-4 animate-spin border-2 border-border border-t-accent-blue rounded-full" />
          <span>CONNECTING TO NAS CONSOLE...</span>
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
          hostInfo={hostInfo}
        />
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
