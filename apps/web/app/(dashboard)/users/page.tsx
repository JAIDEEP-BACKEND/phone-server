'use client';

import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, KeyRound, Check, X, Shield, ShieldAlert } from 'lucide-react';
import { UserProfile, ALL_PERMISSIONS, Permission } from '@android-server/shared';
import { fetchApi } from '@/lib/api';

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create User Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'ADMIN' | 'USER'>('USER');
  const [selectedPerms, setSelectedPerms] = useState<Set<Permission>>(new Set());

  // Password Reset Modal
  const [resetUser, setResetUser] = useState<UserProfile | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetchApi('/api/users');
      setUsers(res.users || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) return;

    try {
      await fetchApi('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
          role: newRole,
          permissions: Array.from(selectedPerms),
        }),
      });
      setShowCreateModal(false);
      setNewUsername('');
      setNewPassword('');
      setSelectedPerms(new Set());
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'User creation failed.');
    }
  };

  const handleToggleActive = async (user: UserProfile) => {
    try {
      await fetchApi(`/api/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Update failed.');
    }
  };

  const handleDeleteUser = async (user: UserProfile) => {
    if (!confirm(`Are you sure you want to permanently delete user "${user.username}"?`)) return;

    try {
      await fetchApi(`/api/users/${user.id}`, { method: 'DELETE' });
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Deletion failed.');
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUser || !resetPasswordVal.trim()) return;

    try {
      await fetchApi(`/api/users/${resetUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ password: resetPasswordVal }),
      });
      setResetUser(null);
      setResetPasswordVal('');
      alert('Password updated successfully.');
    } catch (err: any) {
      setError(err.message || 'Password reset failed.');
    }
  };

  const togglePermissionCheckbox = (perm: Permission) => {
    const next = new Set(selectedPerms);
    if (next.has(perm)) next.delete(perm);
    else next.add(perm);
    setSelectedPerms(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-3">
        <div>
          <h1 className="font-mono text-sm font-semibold uppercase tracking-wider text-fg flex items-center space-x-2">
            <Users className="h-4 w-4 text-accent-blue" />
            <span>Role-Based Access Control & User Directory</span>
          </h1>
          <p className="font-mono text-xs text-fg-muted">
            Manage administrative and standard user accounts and granular capability permissions
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-1.5 rounded border border-accent-blue/50 bg-accent-blue-subtle px-3 py-1.5 font-mono text-xs font-semibold text-accent-blue hover:bg-accent-blue hover:text-white transition-colors"
        >
          <UserPlus className="h-3.5 w-3.5" />
          <span>New User</span>
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded border border-accent-red/50 bg-accent-red-subtle p-3 font-mono text-xs text-accent-red">
          <span>[ERROR] {error}</span>
          <button onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Users Table */}
      <div className="rounded border border-border bg-bg-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full tech-table">
            <thead>
              <tr>
                <th>USERNAME</th>
                <th>ROLE</th>
                <th>STATUS</th>
                <th>PERMISSIONS</th>
                <th>LAST LOGIN</th>
                <th>CREATED</th>
                <th className="text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center font-mono text-xs text-fg-muted">
                    LOADING USER DIRECTORY...
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td className="font-mono text-xs font-semibold text-fg">{u.username}</td>
                    <td>
                      <span
                        className={`font-mono text-[11px] px-2 py-0.5 rounded font-semibold ${
                          u.role === 'ADMIN'
                            ? 'text-accent-blue bg-accent-blue-subtle'
                            : 'text-fg-muted bg-bg-base border border-border'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${
                          u.isActive
                            ? 'text-accent-green bg-accent-green-subtle'
                            : 'text-accent-red bg-accent-red-subtle'
                        }`}
                      >
                        {u.isActive ? 'ACTIVE' : 'DISABLED'}
                      </span>
                    </td>
                    <td className="font-mono text-xs text-fg-muted">
                      {u.role === 'ADMIN' ? (
                        <span className="text-accent-blue font-semibold">ALL_PERMISSIONS (21)</span>
                      ) : (
                        <span>{u.permissions?.length || 0} permissions</span>
                      )}
                    </td>
                    <td className="font-mono text-xs text-fg-subtle whitespace-nowrap">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                    </td>
                    <td className="font-mono text-xs text-fg-subtle whitespace-nowrap">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => handleToggleActive(u)}
                          title={u.isActive ? 'Disable account' : 'Enable account'}
                          className="rounded p-1 text-fg-muted hover:text-fg font-mono text-xs"
                        >
                          {u.isActive ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => {
                            setResetUser(u);
                            setResetPasswordVal('');
                          }}
                          title="Reset Password"
                          className="rounded p-1 text-fg-muted hover:text-accent-blue"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u)}
                          title="Delete User"
                          className="rounded p-1 text-fg-muted hover:text-accent-red"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-lg rounded border border-border bg-bg-panel p-6 max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-2 font-mono text-xs font-semibold text-fg">
              <span>CREATE NEW USER</span>
              <button onClick={() => setShowCreateModal(false)}>
                <X className="h-4 w-4 text-fg-subtle" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-4 font-mono text-xs">
              <div className="space-y-1">
                <label className="text-fg-muted">Username</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full rounded border border-border bg-bg-base px-3 py-2 text-fg outline-none focus:border-accent-blue"
                />
              </div>

              <div className="space-y-1">
                <label className="text-fg-muted">Password (min 8 chars)</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded border border-border bg-bg-base px-3 py-2 text-fg outline-none focus:border-accent-blue"
                />
              </div>

              <div className="space-y-1">
                <label className="text-fg-muted">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full rounded border border-border bg-bg-base px-3 py-2 text-fg outline-none focus:border-accent-blue"
                >
                  <option value="USER">USER (Standard Operator)</option>
                  <option value="ADMIN">ADMIN (Full Privileges)</option>
                </select>
              </div>

              {newRole === 'USER' && (
                <div className="space-y-2">
                  <label className="text-fg-muted">Granular Permissions:</label>
                  <div className="grid grid-cols-2 gap-1 rounded border border-border bg-bg-base p-2 max-h-40 overflow-y-auto">
                    {ALL_PERMISSIONS.map((perm) => (
                      <label key={perm} className="flex items-center space-x-1.5 cursor-pointer text-[11px] text-fg">
                        <input
                          type="checkbox"
                          checked={selectedPerms.has(perm)}
                          onChange={() => togglePermissionCheckbox(perm)}
                        />
                        <span>{perm}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded px-3 py-1.5 text-fg-muted hover:bg-bg-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded bg-accent-blue px-4 py-1.5 text-white font-medium hover:bg-blue-600"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {resetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-sm rounded border border-border bg-bg-panel p-5">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-2 font-mono text-xs font-semibold text-fg">
              <span>RESET PASSWORD: {resetUser.username}</span>
              <button onClick={() => setResetUser(null)}>
                <X className="h-4 w-4 text-fg-subtle" />
              </button>
            </div>
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4 font-mono text-xs">
              <input
                type="password"
                required
                placeholder="New password (min 8 chars)"
                value={resetPasswordVal}
                onChange={(e) => setResetPasswordVal(e.target.value)}
                className="w-full rounded border border-border bg-bg-base px-3 py-2 text-fg outline-none focus:border-accent-blue"
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setResetUser(null)}
                  className="rounded px-3 py-1.5 text-fg-muted hover:bg-bg-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded bg-accent-blue px-4 py-1.5 text-white font-medium hover:bg-blue-600"
                >
                  Save Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
