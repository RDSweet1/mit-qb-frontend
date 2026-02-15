'use client';

import { useState, useEffect } from 'react';
import { Clock, Pause, Play, Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ResponsiveTable } from '@/components/ResponsiveTable';
import type { ScheduleConfig } from '@/lib/types';

const DAY_OPTIONS = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'daily', label: 'Daily' },
];

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}

function statusBadge(status: string | null) {
  if (!status) return <span className="text-xs text-gray-400">Never run</span>;
  switch (status) {
    case 'success':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
          <CheckCircle className="w-3 h-3" /> Success
        </span>
      );
    case 'error':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
          <XCircle className="w-3 h-3" /> Error
        </span>
      );
    case 'skipped_paused':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
          <Pause className="w-3 h-3" /> Paused
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
          <AlertTriangle className="w-3 h-3" /> {status}
        </span>
      );
  }
}

export function SchedulingContent() {
  const [configs, setConfigs] = useState<ScheduleConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [pausingAll, setPausingAll] = useState(false);

  useEffect(() => {
    loadConfigs();
  }, []);

  async function loadConfigs() {
    setLoading(true);
    const { data, error } = await supabase
      .from('schedule_config')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('Error loading schedule configs:', error);
    }
    setConfigs((data || []) as ScheduleConfig[]);
    setLoading(false);
  }

  async function updateConfig(id: number, updates: Partial<ScheduleConfig>) {
    setSaving(id);
    const { error } = await supabase
      .from('schedule_config')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error updating schedule config:', error);
    } else {
      setConfigs(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    }
    setSaving(null);
  }

  async function togglePause(config: ScheduleConfig) {
    const newPaused = !config.is_paused;
    await updateConfig(config.id, {
      is_paused: newPaused,
      paused_by: newPaused ? 'admin' : null,
      paused_at: newPaused ? new Date().toISOString() : null,
    });
  }

  async function pauseResumeAll(pause: boolean) {
    setPausingAll(true);
    const updates = {
      is_paused: pause,
      paused_by: pause ? 'admin' : null,
      paused_at: pause ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('schedule_config')
      .update(updates)
      .gte('id', 0); // update all

    if (error) {
      console.error('Error updating all configs:', error);
    } else {
      setConfigs(prev => prev.map(c => ({ ...c, ...updates })));
    }
    setPausingAll(false);
  }

  const pausedCount = configs.filter(c => c.is_paused).length;

  if (loading) {
    return <LoadingSkeleton variant="table" rows={4} columns={6} />;
  }

  return (
    <div>
      {/* Holiday Mode Buttons */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Automation Control</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {pausedCount > 0
              ? `${pausedCount} automation${pausedCount > 1 ? 's' : ''} paused`
              : 'All automations active'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => pauseResumeAll(true)}
            disabled={pausingAll || pausedCount === configs.length}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
          >
            {pausingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pause className="w-4 h-4" />}
            Pause All
          </button>
          <button
            onClick={() => pauseResumeAll(false)}
            disabled={pausingAll || pausedCount === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors"
          >
            {pausingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Resume All
          </button>
        </div>
      </div>

      {/* Schedule Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <ResponsiveTable>
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Automation</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Day</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Time</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Last Run</th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {configs.map(config => (
              <tr key={config.id} className={config.is_paused ? 'bg-gray-50' : 'hover:bg-gray-50'}>
                <td className="px-4 py-3">
                  <div className="font-medium text-sm text-gray-900">{config.display_name}</div>
                  <div className="text-xs text-gray-500">{config.description}</div>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={config.schedule_day}
                    onChange={e => updateConfig(config.id, { schedule_day: e.target.value })}
                    disabled={saving === config.id}
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    {DAY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={config.schedule_time?.slice(0, 5) || '09:00'}
                    onChange={e => updateConfig(config.id, { schedule_time: e.target.value })}
                    disabled={saving === config.id}
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    {TIME_OPTIONS.map(t => (
                      <option key={t} value={t}>
                        {(() => {
                          const [h, m] = t.split(':').map(Number);
                          const ampm = h >= 12 ? 'PM' : 'AM';
                          const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
                          return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
                        })()}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  {config.is_paused ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                      <Pause className="w-3 h-3" /> Paused
                    </span>
                  ) : (
                    statusBadge(config.last_run_status)
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {config.last_run_at
                    ? new Date(config.last_run_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : 'Never'}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => togglePause(config)}
                    disabled={saving === config.id}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      config.is_paused
                        ? 'text-green-700 bg-green-50 border border-green-200 hover:bg-green-100'
                        : 'text-red-700 bg-red-50 border border-red-200 hover:bg-red-100'
                    } disabled:opacity-50`}
                  >
                    {saving === config.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : config.is_paused ? (
                      <Play className="w-3 h-3" />
                    ) : (
                      <Pause className="w-3 h-3" />
                    )}
                    {config.is_paused ? 'Resume' : 'Pause'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </ResponsiveTable>
      </div>

      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800">
          <strong>Note:</strong> Changes take effect immediately. Paused automations will skip
          their next scheduled run. Use &ldquo;Pause All&rdquo; during holidays to prevent all
          automated emails from being sent.
        </p>
      </div>
    </div>
  );
}
