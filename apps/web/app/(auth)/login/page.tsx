'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetchApi('/api/auth/status');
        if (res.authenticated) {
          router.replace('/');
          return;
        }
        setHasAdmin(res.hasAdmin);
      } catch (err: any) {
        setError('Failed to reach server backend.');
      }
    }
    checkStatus();
  }, [router]);

  const handleFirstAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await fetchApi('/api/auth/first-admin', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      // Automatically login after initial registration
      await fetchApi('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      router.replace('/');
    } catch (err: any) {
      setError(err.message || 'Setup failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await fetchApi('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      router.replace('/');
    } catch (err: any) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  if (hasAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-base font-mono text-xs text-fg-muted">
        VERIFYING SERVER STATE...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-base px-4">
      <div className="w-full max-w-sm rounded border border-border bg-bg-panel p-6 shadow-2xl">
        {/* Terminal Header */}
        <div className="mb-6 flex items-center justify-between border-b border-border pb-3 font-mono text-xs">
          <div className="flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-accent-blue" />
            <span className="font-semibold text-fg">PHONE_SERVER_AUTH</span>
          </div>
          <span className="text-[11px] text-fg-subtle">
            {hasAdmin ? 'ACCESS_CONTROL' : 'INITIAL_SETUP'}
          </span>
        </div>

        {error && (
          <div className="mb-4 rounded border border-accent-red/50 bg-accent-red-subtle p-2.5 font-mono text-xs text-accent-red">
            [ERROR] {error}
          </div>
        )}

        {!hasAdmin ? (
          /* First Admin Setup Form */
          <form onSubmit={handleFirstAdminSubmit} className="space-y-4">
            <div className="font-mono text-xs text-fg-muted">
              No administrator exists.
              <br />
              Create administrator:
            </div>

            <div className="space-y-1">
              <label className="block font-mono text-xs text-fg-muted">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded border border-border bg-bg-base px-3 py-2 font-mono text-xs text-fg outline-none focus:border-accent-blue"
                autoComplete="username"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-mono text-xs text-fg-muted">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded border border-border bg-bg-base px-3 py-2 font-mono text-xs text-fg outline-none focus:border-accent-blue"
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-mono text-xs text-fg-muted">Confirm Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded border border-border bg-bg-base px-3 py-2 font-mono text-xs text-fg outline-none focus:border-accent-blue"
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded bg-accent-blue py-2 font-mono text-xs font-semibold text-white transition hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'CREATING ADMIN...' : 'CREATE ADMINISTRATOR'}
            </button>
          </form>
        ) : (
          /* Standard Login Form */
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="block font-mono text-xs text-fg-muted">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded border border-border bg-bg-base px-3 py-2 font-mono text-xs text-fg outline-none focus:border-accent-blue"
                autoComplete="username"
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label className="block font-mono text-xs text-fg-muted">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded border border-border bg-bg-base px-3 py-2 font-mono text-xs text-fg outline-none focus:border-accent-blue"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded bg-accent-blue py-2 font-mono text-xs font-semibold text-white transition hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'AUTHENTICATING...' : 'LOGIN'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
