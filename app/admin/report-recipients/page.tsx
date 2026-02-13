'use client';

import { useState, useEffect } from 'react';
import { Mail, Plus, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { supabase } from '@/lib/supabaseClient';

interface Recipient {
  id: number;
  email: string;
  display_name: string | null;
  report_type: string;
  is_active: boolean;
  created_at: string;
}

export default function ReportRecipientsPage() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('all');

  const loadRecipients = async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('report_recipients')
      .select('*')
      .order('created_at');
    if (err) {
      setError(err.message);
    } else {
      setRecipients(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { loadRecipients(); }, []);

  const flashSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const addRecipient = async () => {
    if (!newEmail.trim()) {
      setError('Email is required');
      return;
    }
    setSaving('add');
    const { error: err } = await supabase
      .from('report_recipients')
      .insert({
        email: newEmail.trim(),
        display_name: newName.trim() || null,
        report_type: newType,
      });
    if (err) {
      setError(err.message);
    } else {
      flashSuccess(`Added ${newEmail.trim()}`);
      setNewEmail('');
      setNewName('');
      setNewType('all');
      setShowAddForm(false);
      await loadRecipients();
    }
    setSaving(null);
  };

  const toggleActive = async (id: number, current: boolean) => {
    setSaving(`${id}-active`);
    const { error: err } = await supabase
      .from('report_recipients')
      .update({ is_active: !current })
      .eq('id', id);
    if (err) {
      setError(err.message);
    } else {
      setRecipients(recipients.map(r => r.id === id ? { ...r, is_active: !current } : r));
    }
    setSaving(null);
  };

  const updateType = async (id: number, reportType: string) => {
    setSaving(`${id}-type`);
    const { error: err } = await supabase
      .from('report_recipients')
      .update({ report_type: reportType })
      .eq('id', id);
    if (err) {
      setError(err.message);
    } else {
      setRecipients(recipients.map(r => r.id === id ? { ...r, report_type: reportType } : r));
    }
    setSaving(null);
  };

  const deleteRecipient = async (id: number, email: string) => {
    if (!confirm(`Remove ${email} from report recipients?`)) return;
    setSaving(`${id}-delete`);
    const { error: err } = await supabase
      .from('report_recipients')
      .delete()
      .eq('id', id);
    if (err) {
      setError(err.message);
    } else {
      setRecipients(recipients.filter(r => r.id !== id));
      flashSuccess(`Removed ${email}`);
    }
    setSaving(null);
  };

  const typeLabel: Record<string, string> = {
    profitability: 'Profitability',
    reconciliation: 'Reconciliation',
    all: 'All Reports',
  };

  const typeBadge: Record<string, string> = {
    profitability: 'bg-purple-100 text-purple-800',
    reconciliation: 'bg-blue-100 text-blue-800',
    all: 'bg-green-100 text-green-800',
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Mail className="w-6 h-6 text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Report Recipients</h2>
          <p className="text-sm text-gray-600">Configure who receives automated reports</p>
        </div>
      </div>
          {/* Messages */}
          {error && (
            <div className="mb-6 p-4 rounded-lg border bg-red-50 border-red-300 text-red-800">
              {error}
              <button onClick={() => setError(null)} className="ml-4 text-red-600 underline text-sm">Dismiss</button>
            </div>
          )}
          {success && (
            <div className="mb-6 p-4 rounded-lg border bg-green-50 border-green-300 text-green-800">
              {success}
            </div>
          )}

          {/* Action Buttons */}
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">
              <Mail className="w-5 h-5 inline mr-1" />
              {recipients.length} Recipients
            </h2>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Recipient
            </button>
          </div>

          {/* Add Form */}
          {showAddForm && (
            <div className="mb-6 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Report Recipient</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Reports</option>
                    <option value="profitability">Profitability Only</option>
                    <option value="reconciliation">Reconciliation Only</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addRecipient}
                  disabled={saving === 'add'}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving === 'add' ? 'Adding...' : 'Add Recipient'}
                </button>
                <button
                  onClick={() => { setShowAddForm(false); setNewEmail(''); setNewName(''); }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Recipient</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Report Type</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Active</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {recipients.map(r => (
                      <tr key={r.id} className={`hover:bg-gray-50 ${!r.is_active ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">{r.display_name || r.email}</p>
                          {r.display_name && <p className="text-xs text-gray-500">{r.email}</p>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <select
                            value={r.report_type}
                            onChange={e => updateType(r.id, e.target.value)}
                            disabled={saving === `${r.id}-type`}
                            className="px-2 py-1 text-sm border border-gray-300 rounded-lg bg-white"
                          >
                            <option value="all">All Reports</option>
                            <option value="profitability">Profitability</option>
                            <option value="reconciliation">Reconciliation</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => toggleActive(r.id, r.is_active)}
                            disabled={saving === `${r.id}-active`}
                            className={`w-10 h-6 rounded-full relative transition-colors ${
                              r.is_active ? 'bg-blue-600' : 'bg-gray-300'
                            } ${saving === `${r.id}-active` ? 'opacity-50' : ''}`}
                          >
                            <span
                              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                                r.is_active ? 'translate-x-4' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => deleteRecipient(r.id, r.email)}
                            disabled={saving === `${r.id}-delete`}
                            className="text-red-500 hover:text-red-700 disabled:opacity-30 p-1"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
      </div>
    </AppShell>
  );
}
