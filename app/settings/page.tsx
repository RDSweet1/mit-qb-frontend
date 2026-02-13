'use client';

import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Link as LinkIcon, RefreshCw, Database, Calendar, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { AppShell } from '@/components/AppShell';

export default function SettingsPage() {
  const [qbStatus, setQbStatus] = useState<'connected' | 'disconnected' | 'unknown'>('unknown');
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    checkQuickBooksConnection();
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
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
        <p className="text-sm text-gray-600">Configure integrations and automation</p>
      </div>
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
              <p className="text-sm text-gray-600">Scheduled tasks and cron jobs</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">Weekly Reports</span>
                <span className="text-xs text-gray-500">Mondays @ 9 AM</span>
              </div>
              <p className="text-xs text-gray-600">
                Automatically sends weekly time reports to customers every Monday morning
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">Monthly Invoices</span>
                <span className="text-xs text-gray-500">1st of month @ 10 AM</span>
              </div>
              <p className="text-xs text-gray-600">
                Creates monthly invoices in QuickBooks on the first day of each month
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">Time Sync</span>
                <span className="text-xs text-gray-500">Daily @ 8 AM</span>
              </div>
              <p className="text-xs text-gray-600">
                Syncs time entries from QuickBooks Workforce daily
              </p>
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>Note:</strong> Automation is configured via Supabase Edge Functions and PostgreSQL cron jobs. Contact your administrator to modify schedules.
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
          </div>
        </div>
      </div>
    </AppShell>
  );
}
