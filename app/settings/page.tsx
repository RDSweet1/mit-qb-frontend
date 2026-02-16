'use client';

import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Link as LinkIcon, RefreshCw, Database, Calendar, Mail, Pause, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import type { ScheduleConfig } from '@/lib/types';

function formatTime12(time: string): string {
  const [h, m] = (time || '09:00').split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatDay(day: string): string {
  if (day === 'weekdays') return 'Weekdays';
  if (day === 'daily') return 'Daily';
  return day.charAt(0).toUpperCase() + day.slice(1) + 's';
}

export default function SettingsPage() {
  const [qbStatus, setQbStatus] = useState<'connected' | 'disconnected' | 'unknown'>('unknown');
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<ScheduleConfig[]>([]);
  const [gentleLanguage, setGentleLanguage] = useState<boolean | null>(null);

  useEffect(() => {
    checkQuickBooksConnection();
    loadSchedules();
    loadEmailSetting();
  }, []);

  const checkQuickBooksConnection = async () => {
    try {
      setLoading(true);
      // Check if QB tokens exist in database
      const { data, error } = await supabase
        .from('qb_tokens')
        .select('access_token, expires_at')
        .single();

      if (error || !data) {
        setQbStatus('disconnected');
      } else {
        const expiresAt = new Date(data.expires_at);
        if (expiresAt > new Date()) {
          setQbStatus('connected');
        } else {
          setQbStatus('disconnected');
        }
      }

      // Get last sync time
      const { data: syncData } = await supabase
        .from('time_entries')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (syncData) {
        setLastSync(syncData.created_at);
      }
    } catch (err) {
      console.error('Error checking QB connection:', err);
      setQbStatus('unknown');
    } finally {
      setLoading(false);
    }
  };

  const loadSchedules = async () => {
    const { data } = await supabase
      .from('schedule_config')
      .select('*')
      .order('id', { ascending: true });
    setSchedules((data || []) as ScheduleConfig[]);
  };

  const loadEmailSetting = async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'gentle_review_language')
      .single();
    setGentleLanguage(data?.value === 'true');
  };

  const connectToQuickBooks = () => {
    // Open QuickBooks OAuth connection
    window.open(
      'https://migcpasmtbdojqphqyzc.supabase.co/functions/v1/connect-qb',
      'QuickBooks OAuth',
      'width=800,height=600'
    );
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Settings"
        subtitle="Configure integrations and automation"
        icon={<SettingsIcon className="w-6 h-6 text-gray-600" />}
      />
        {/* QuickBooks Connection */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <LinkIcon className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">QuickBooks Connection</h2>
                <p className="text-sm text-gray-600">Manage QuickBooks Online integration</p>
              </div>
            </div>
            <button
              onClick={checkQuickBooksConnection}
              disabled={loading}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh connection status"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">Connection Status</p>
                <p className="text-xs text-gray-500">OAuth 2.0 authentication</p>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  qbStatus === 'connected' ? 'bg-green-500' :
                  qbStatus === 'disconnected' ? 'bg-red-500' :
                  'bg-gray-400'
                }`}></div>
                <span className={`text-sm font-semibold ${
                  qbStatus === 'connected' ? 'text-green-600' :
                  qbStatus === 'disconnected' ? 'text-red-600' :
                  'text-gray-600'
                }`}>
                  {qbStatus === 'connected' ? 'Connected' :
                   qbStatus === 'disconnected' ? 'Disconnected' :
                   'Checking...'}
                </span>
              </div>
            </div>

            {lastSync && (
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">Last Sync</p>
                  <p className="text-xs text-gray-500">Most recent data update</p>
                </div>
                <span className="text-sm text-gray-900">
                  {new Date(lastSync).toLocaleString()}
                </span>
              </div>
            )}

            {qbStatus === 'disconnected' && (
              <button
                onClick={connectToQuickBooks}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                <LinkIcon className="w-5 h-5" />
                Connect to QuickBooks
              </button>
            )}

            {qbStatus === 'connected' && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  ✓ Successfully connected to QuickBooks Online. You can now sync time entries and create invoices.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Database Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Database className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Database</h2>
              <p className="text-sm text-gray-600">Supabase PostgreSQL</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-900">Database Region</span>
              <span className="text-sm text-gray-600">US-East-1 (Virginia)</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-900">Row-Level Security</span>
              <span className="text-sm text-green-600">✓ Enabled</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-900">Encryption</span>
              <span className="text-sm text-green-600">✓ TLS 1.3</span>
            </div>
          </div>
        </div>

        {/* Automation Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Automation</h2>
              <p className="text-sm text-gray-600">Scheduled tasks and automation status</p>
            </div>
          </div>

          <div className="space-y-3">
            {schedules.length > 0 ? schedules.map(s => (
              <div key={s.id} className={`p-4 rounded-lg ${s.is_paused ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{s.display_name}</span>
                    {s.is_paused && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                        <Pause className="w-3 h-3" /> Paused
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatDay(s.schedule_day)} @ {formatTime12(s.schedule_time)}
                  </span>
                </div>
                <p className="text-xs text-gray-600">{s.description}</p>
                {s.last_run_at && (
                  <p className="text-xs text-gray-400 mt-1">
                    Last run: {new Date(s.last_run_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    {s.last_run_status === 'success' && <CheckCircle className="w-3 h-3 text-green-500 inline ml-1" />}
                  </p>
                )}
              </div>
            )) : (
              <>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">Weekly Reports</span>
                    <span className="text-xs text-gray-500">Mondays @ 9:00 AM</span>
                  </div>
                  <p className="text-xs text-gray-600">Send weekly time reports to customers</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">Follow-Up Reminders</span>
                    <span className="text-xs text-gray-500">Weekdays @ 9:00 AM</span>
                  </div>
                  <p className="text-xs text-gray-600">3-day reminder sequence for unreviewed reports</p>
                </div>
              </>
            )}
          </div>

          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>Note:</strong> Schedules can be modified by administrators on the Admin &rarr; Scheduling tab.
            </p>
          </div>
        </div>

        {/* Email Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Mail className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Email Delivery</h2>
              <p className="text-sm text-gray-600">Microsoft Graph API</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-900">Service</span>
              <span className="text-sm text-gray-600">Outlook / Microsoft 365</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-900">Authentication</span>
              <span className="text-sm text-green-600">✓ Azure AD</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-900">From Address</span>
              <span className="text-sm text-gray-600">accounting@mitigationconsulting.com</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <span className="text-sm font-medium text-gray-900">Review Language</span>
                <p className="text-xs text-gray-500">Tone used in customer-facing review notices</p>
              </div>
              <div className="flex items-center gap-2">
                {gentleLanguage === null ? (
                  <span className="text-sm text-gray-400">Loading...</span>
                ) : gentleLanguage ? (
                  <span className="text-sm font-medium text-blue-600">Gentle</span>
                ) : (
                  <span className="text-sm font-medium text-amber-600">Standard</span>
                )}
                <a
                  href="/mit-qb-frontend/admin?tab=email"
                  className="text-xs text-indigo-600 hover:text-indigo-800 underline ml-2"
                >
                  Change
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
