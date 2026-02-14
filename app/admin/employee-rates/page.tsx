'use client';

import { useState, useEffect } from 'react';
import { DollarSign, Plus, Trash2, RefreshCw, Save } from 'lucide-react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { supabase } from '@/lib/supabaseClient';
import type { EmployeeRate } from '@/lib/types';

export default function EmployeeRatesPage() {

  const [rates, setRates] = useState<EmployeeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Inline editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editField, setEditField] = useState<string>('');
  const [editValue, setEditValue] = useState<string>('');

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRate, setNewRate] = useState('');
  const [newMultiplier, setNewMultiplier] = useState('1.35');
  const [newRole, setNewRole] = useState('technician');

  const loadRates = async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('employee_cost_rates')
      .select('*')
      .order('employee_name');
    if (err) {
      setError(err.message);
    } else {
      setRates(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { loadRates(); }, []);

  const flashSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  // Save inline edit
  const saveEdit = async (id: number, field: string, value: string) => {
    setSaving(`${id}-${field}`);
    const numVal = parseFloat(value);
    if (isNaN(numVal) || numVal < 0) {
      setError('Please enter a valid number');
      setSaving(null);
      return;
    }
    const { error: err } = await supabase
      .from('employee_cost_rates')
      .update({ [field]: numVal, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (err) {
      setError(err.message);
    } else {
      flashSuccess('Saved');
      await loadRates();
    }
    setEditingId(null);
    setSaving(null);
  };

  // Update role
  const updateRole = async (id: number, role: string) => {
    setSaving(`${id}-role`);
    const { error: err } = await supabase
      .from('employee_cost_rates')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (err) {
      setError(err.message);
    } else {
      setRates(rates.map(r => r.id === id ? { ...r, role } : r));
    }
    setSaving(null);
  };

  // Toggle active
  const toggleActive = async (id: number, current: boolean) => {
    setSaving(`${id}-active`);
    const { error: err } = await supabase
      .from('employee_cost_rates')
      .update({ is_active: !current, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (err) {
      setError(err.message);
    } else {
      setRates(rates.map(r => r.id === id ? { ...r, is_active: !current } : r));
    }
    setSaving(null);
  };

  // Add employee
  const addEmployee = async () => {
    if (!newName.trim()) {
      setError('Employee name is required');
      return;
    }
    setSaving('add');
    const { error: err } = await supabase
      .from('employee_cost_rates')
      .insert({
        employee_name: newName.trim(),
        base_hourly_rate: parseFloat(newRate) || 0,
        burden_multiplier: parseFloat(newMultiplier) || 1.35,
        role: newRole,
      });
    if (err) {
      setError(err.message);
    } else {
      flashSuccess(`Added ${newName.trim()}`);
      setNewName('');
      setNewRate('');
      setNewMultiplier('1.35');
      setNewRole('technician');
      setShowAddForm(false);
      await loadRates();
    }
    setSaving(null);
  };

  // Delete
  const deleteEmployee = async (id: number, name: string) => {
    if (!confirm(`Delete cost rate for ${name}? This cannot be undone.`)) return;
    setSaving(`${id}-delete`);
    const { error: err } = await supabase
      .from('employee_cost_rates')
      .delete()
      .eq('id', id);
    if (err) {
      setError(err.message);
    } else {
      setRates(rates.filter(r => r.id !== id));
      flashSuccess(`Deleted ${name}`);
    }
    setSaving(null);
  };

  // Sync from time_entries — find employee names not yet in cost rates
  const [syncing, setSyncing] = useState(false);
  const syncFromTimeEntries = async () => {
    setSyncing(true);
    setError(null);
    const { data: allEntries } = await supabase
      .from('time_entries')
      .select('employee_name')
      .not('employee_name', 'is', null);

    if (!allEntries) {
      setError('Failed to fetch time entries');
      setSyncing(false);
      return;
    }

    const existingNames = new Set(rates.map(r => r.employee_name));
    const newNames = [...new Set(allEntries.map(e => e.employee_name).filter(n => n && !existingNames.has(n)))];

    if (newNames.length === 0) {
      flashSuccess('All employees already have cost rates');
      setSyncing(false);
      return;
    }

    const inserts = newNames.map(name => ({
      employee_name: name,
      base_hourly_rate: 0,
      burden_multiplier: 1.35,
      role: 'technician' as const,
    }));

    const { error: err } = await supabase.from('employee_cost_rates').insert(inserts);
    if (err) {
      setError(err.message);
    } else {
      flashSuccess(`Added ${newNames.length} new employee(s): ${newNames.join(', ')}`);
      await loadRates();
    }
    setSyncing(false);
  };

  const startEdit = (id: number, field: string, currentValue: number) => {
    setEditingId(id);
    setEditField(field);
    setEditValue(String(currentValue));
  };

  return (
    <AppShell>
      <PageHeader
        title="Employee Cost Rates"
        subtitle="Manage labor cost rates and burden multipliers"
        icon={<DollarSign className="w-6 h-6 text-emerald-600" />}
      />
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

          {/* Info Banner */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Burden Multiplier</strong> covers payroll taxes, workers&apos; comp, and benefits.
              FL standard is ~1.35. <strong>Fully Loaded Rate</strong> = Base Rate &times; Multiplier.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="mb-6 flex flex-wrap justify-between items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
              <DollarSign className="w-5 h-5 inline mr-1" />
              {rates.length} Employees
            </h2>
            <div className="flex gap-2">
              <button
                onClick={syncFromTimeEntries}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                Sync from Time Entries
              </button>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Employee
              </button>
            </div>
          </div>

          {/* Add Form */}
          {showAddForm && (
            <div className="mb-6 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Employee Cost Rate</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Base Hourly Rate ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newRate}
                    onChange={e => setNewRate(e.target.value)}
                    placeholder="25.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Burden Multiplier</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newMultiplier}
                    onChange={e => setNewMultiplier(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={newRole}
                    onChange={e => setNewRole(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="technician">Technician</option>
                    <option value="admin">Admin</option>
                    <option value="owner">Owner</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addEmployee}
                  disabled={saving === 'add'}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving === 'add' ? 'Adding...' : 'Add Employee'}
                </button>
                <button
                  onClick={() => { setShowAddForm(false); setNewName(''); setNewRate(''); }}
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
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Employee</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Role</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Base Rate</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Multiplier</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Loaded Rate</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Active</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {rates.map(rate => (
                      <tr key={rate.id} className={`hover:bg-gray-50 ${!rate.is_active ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">{rate.employee_name}</p>
                          {rate.qb_employee_id && (
                            <p className="text-xs text-gray-500">QB ID: {rate.qb_employee_id}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <select
                            value={rate.role}
                            onChange={e => updateRole(rate.id, e.target.value)}
                            disabled={saving === `${rate.id}-role`}
                            className="px-2 py-1 text-sm border border-gray-300 rounded-lg bg-white"
                          >
                            <option value="technician">Technician</option>
                            <option value="admin">Admin</option>
                            <option value="owner">Owner</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {editingId === rate.id && editField === 'base_hourly_rate' ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-gray-500">$</span>
                              <input
                                type="number"
                                step="0.01"
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') saveEdit(rate.id, 'base_hourly_rate', editValue);
                                  if (e.key === 'Escape') setEditingId(null);
                                }}
                                onBlur={() => saveEdit(rate.id, 'base_hourly_rate', editValue)}
                                autoFocus
                                className="w-20 px-2 py-1 text-sm text-right border border-emerald-400 rounded focus:ring-2 focus:ring-emerald-500"
                              />
                            </div>
                          ) : (
                            <button
                              onClick={() => startEdit(rate.id, 'base_hourly_rate', rate.base_hourly_rate)}
                              className="text-sm font-medium text-gray-900 hover:text-emerald-600 cursor-pointer"
                              title="Click to edit"
                            >
                              ${rate.base_hourly_rate.toFixed(2)}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {editingId === rate.id && editField === 'burden_multiplier' ? (
                            <input
                              type="number"
                              step="0.01"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveEdit(rate.id, 'burden_multiplier', editValue);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              onBlur={() => saveEdit(rate.id, 'burden_multiplier', editValue)}
                              autoFocus
                              className="w-16 px-2 py-1 text-sm text-right border border-emerald-400 rounded focus:ring-2 focus:ring-emerald-500"
                            />
                          ) : (
                            <button
                              onClick={() => startEdit(rate.id, 'burden_multiplier', rate.burden_multiplier)}
                              className="text-sm text-gray-900 hover:text-emerald-600 cursor-pointer"
                              title="Click to edit"
                            >
                              {rate.burden_multiplier.toFixed(2)}x
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-bold text-emerald-700">
                            ${rate.fully_loaded_rate.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => toggleActive(rate.id, rate.is_active)}
                            disabled={saving === `${rate.id}-active`}
                            className={`w-10 h-6 rounded-full relative transition-colors ${
                              rate.is_active ? 'bg-emerald-600' : 'bg-gray-300'
                            } ${saving === `${rate.id}-active` ? 'opacity-50' : ''}`}
                          >
                            <span
                              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                                rate.is_active ? 'translate-x-4' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => deleteEmployee(rate.id, rate.employee_name)}
                            disabled={saving === `${rate.id}-delete`}
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

          {/* Link to Report Recipients */}
          <div className="mt-8 text-center">
            <Link
              href="/admin/report-recipients"
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Manage Report Recipients &rarr;
            </Link>
          </div>
    </AppShell>
  );
}
