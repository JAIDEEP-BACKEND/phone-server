'use client';

import dynamic from 'next/dynamic';

const TerminalClient = dynamic(
  () => import('@/components/terminal/terminal-client'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[calc(100vh-6.5rem)] w-full items-center justify-center rounded border border-border bg-bg-panel font-mono text-xs text-fg-muted">
        INITIALIZING PTY TERMINAL...
      </div>
    ),
  }
);

export default function TerminalPage() {
  return <TerminalClient />;
}
