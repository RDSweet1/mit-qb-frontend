'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Users, Plus, Trash2, LogOut, Shield, Mail, Check } from 'lucide-react';
import Link from 'next/link';
import { useMsal } from '@azure/msal-react';
import { ProtectedPage } from '@/components/ProtectedPage';
import { callEdgeFunction } from '@/lib/supabaseClient';

interface AppUser {
  id: string;
  email: string;
  display_name: string;
  entra_id: string;
  can_view: boolean;
  can_send_reminders: boolean;
  can_create_invoices: boolean;
  is_admin: boolean;
  can_edit_time: boolean;
  can_manage_users: boolean;
  last_login: string | null;
  created_at: string;
}

export default function AdminUsersPage() {
  const { instance, accounts } = useMsal();
  const user = accounts[0];
  const adminEmail = user?.username || '';

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  // Add user form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [adding, setAdding] = useState(false);

  const handleLogout = () => {
    instance.logoutPopup();
  };

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await callEdgeFunction('manage_users', {
        action: 'list',
        admin_email: adminEmail,
      });
      if (result.success) {
        setUsers(result.users);
      } else {
        setError(result.error || 'Failed to load users');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = async (userId: string, field: string, currentValue: boolean) => {
    setSaving(userId + field);
    try {
      const result = await callEdgeFunction('manage_users', {
        action: 'update',
        admin_email: adminEmail,
        user_data: { id: userId, [field]: !currentValue },
      });
      if (result.success) {
        setUsers(users.map(u => u.id === userId ? { ...u, [field]: !currentValue } : u));
      } else {
        setError(result.error || 'Failed to update permission');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(null);
    }
  };

  const addUser = async () => {
    if (!newEmail || !newDisplayName) {
      setError('Email and display name are required');
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const result = await callEdgeFunction('manage_users', {
        action: 'create',
        admin_email: adminEmail,
        user_data: { email: newEmail, display_name: newDisplayName },
      });
      if (result.success) {
        setUsers([...users, result.user]);
        setNewEmail('');
        setNewDisplayName('');
        setShowAddForm(false);
      } else {
        setError(result.error || 'Failed to add user');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add user');
    } finally {
      setAdding(false);
    }
  };

  const deleteUser = async (userId: string, email: string) => {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return;

    setSaving(userId);
    try {
      const result = await callEdgeFunction('manage_users', {
        action: 'delete',
        admin_email: adminEmail,
        user_data: { id: userId },
      });
      if (result.success) {
        setUsers(users.filter(u => u.id !== userId));
      } else {
        setError(result.error || 'Failed to delete user');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setSaving(null);
    }
  };

  // Invite user
  const [inviting, setInviting] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  const inviteUser = async (appUser: AppUser) => {
    if (!confirm(`Send onboarding invitation to ${appUser.display_name} (${appUser.email})?\n\nThey'll receive an email with a personalized link to the app.`)) return;

    setInviting(appUser.id);
    setInviteResult(null);
    try {
      const result = await callEdgeFunction('invite-user', {
        email: appUser.email,
        display_name: appUser.display_name,
        admin_email: adminEmail,
      });
      if (result.success) {
        setInviteResult({ id: appUser.id, success: true, message: 'Invite sent!' });
        setTimeout(() => setInviteResult(null), 5000);
      } else {
        setInviteResult({ id: appUser.id, success: false, message: result.error || 'Failed to send' });
      }
    } catch (err) {
      setInviteResult({ id: appUser.id, success: false, message: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setInviting(null);
    }
  };

  useEffect(() => {
    if (adminEmail) {
      loadUsers();
    }
  }, [adminEmail]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  };

  const permissionFields = [
    { key: 'can_view', label: 'View' },
    { key: 'can_edit_time', label: 'Edit Time' },
    { key: 'can_send_reminders', label: 'Send Reminders' },
    { key: 'can_create_invoices', label: 'Create Invoices' },
    { key: 'can_manage_users', label: 'Manage Users' },
    { key: 'is_admin', label: 'Admin' },
  ];

  return (
    <ProtectedPage>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/" className="text-gray-600 hover:text-gray-900">
                  <ArrowLeft className="w-6 h-6" />
                </Link>
                <div className="flex items-center gap-2">
                  <Shield className="w-6 h-6 text-indigo-600" />
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                    <p className="text-sm text-gray-600">Manage app users and permissions</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right hidden md:block">
                  <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                  <p className="text-xs text-gray-500">{user?.username}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {error && (
            <div className={`mb-6 p-4 rounded-lg border ${
              error.startsWith('✅')
                ? 'bg-green-50 border-green-300 text-green-800'
                : 'bg-red-50 border-red-300 text-red-800'
            }`}>
              {error}
            </div>
          )}

          {/* Add User Button */}
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">
              <Users className="w-5 h-5 inline mr-2" />
              {users.length} Users
            </h2>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add User
            </button>
          </div>

          {/* Add User Form */}
          {showAddForm && (
            <div className="mb-6 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New User</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="user@mitigationconsulting.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addUser}
                  disabled={adding}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {adding ? 'Adding...' : 'Add User'}
                </button>
                <button
                  onClick={() => { setShowAddForm(false); setNewEmail(''); setNewDisplayName(''); }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Users Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">User</th>
                      {permissionFields.map(pf => (
                        <th key={pf.key} className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                          {pf.label}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Last Login</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.map(appUser => (
                      <tr key={appUser.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{appUser.display_name}</p>
                            <p className="text-xs text-gray-500">{appUser.email}</p>
                          </div>
                        </td>
                        {permissionFields.map(pf => (
                          <td key={pf.key} className="px-3 py-3 text-center">
                            <button
                              onClick={() => togglePermission(appUser.id, pf.key, (appUser as any)[pf.key])}
                              disabled={saving === appUser.id + pf.key}
                              className={`w-10 h-6 rounded-full relative transition-colors ${
                                (appUser as any)[pf.key]
                                  ? 'bg-indigo-600'
                                  : 'bg-gray-300'
                              } ${saving === appUser.id + pf.key ? 'opacity-50' : ''}`}
                            >
                              <span
                                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                                  (appUser as any)[pf.key] ? 'translate-x-4' : 'translate-x-0.5'
                                }`}
                              />
                            </button>
                          </td>
                        ))}
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {formatDate(appUser.last_login)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => inviteUser(appUser)}
                              disabled={inviting === appUser.id}
                              className="text-blue-500 hover:text-blue-700 disabled:opacity-50 p-1"
                              title="Send onboarding invite email"
                            >
                              {inviting === appUser.id ? (
                                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                              ) : inviteResult?.id === appUser.id && inviteResult.success ? (
                                <Check className="w-4 h-4 text-green-500" />
                              ) : (
                                <Mail className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => deleteUser(appUser.id, appUser.email)}
                              disabled={appUser.email === adminEmail || saving === appUser.id}
                              className="text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed p-1"
                              title={appUser.email === adminEmail ? 'Cannot delete yourself' : 'Delete user'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          {inviteResult?.id === appUser.id && (
                            <div className={`text-xs mt-1 ${inviteResult.success ? 'text-green-600' : 'text-red-600'}`}>
                              {inviteResult.message}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </ProtectedPage>
  );
}
