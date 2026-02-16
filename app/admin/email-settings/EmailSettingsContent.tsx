'use client';

import { useState, useEffect } from 'react';
import { Loader2, Check, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export function EmailSettingsContent() {
  const [gentle, setGentle] = useState(false);
  const [autoInvoice, setAutoInvoice] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['gentle_review_language', 'auto_send_invoices']);

    if (data) {
      for (const row of data) {
        if (row.key === 'gentle_review_language') setGentle(row.value === 'true');
        if (row.key === 'auto_send_invoices') setAutoInvoice(row.value === 'true');
      }
    }
    setLoading(false);
  };

  const toggleSetting = async (key: string, currentValue: boolean, setter: (v: boolean) => void) => {
    const newValue = !currentValue;
    setSaving(key);
    setSaved(null);
    const { error } = await supabase
      .from('app_settings')
      .update({ value: String(newValue), updated_at: new Date().toISOString() })
      .eq('key', key);

    if (!error) {
      setter(newValue);
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    }
    setSaving(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Review Language Toggle Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Review Language Tone</h3>
            <p className="text-sm text-gray-500 mt-1">
              Controls the tone of customer-facing review notices in weekly reports, supplemental reports, and follow-up reminders.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {saving === 'gentle_review_language' && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
            {saved === 'gentle_review_language' && <Check className="w-4 h-4 text-green-500" />}
            <button
              onClick={() => toggleSetting('gentle_review_language', gentle, setGentle)}
              disabled={saving !== null}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                gentle ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${
                  gentle ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6">
          <span className={`text-sm font-medium ${!gentle ? 'text-gray-900' : 'text-gray-400'}`}>Standard</span>
          <span className="text-gray-300">/</span>
          <span className={`text-sm font-medium ${gentle ? 'text-blue-700' : 'text-gray-400'}`}>Gentle</span>
        </div>

        {/* Preview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Standard Preview */}
          <div className={`rounded-lg border-2 p-4 ${!gentle ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs font-semibold uppercase tracking-wide ${!gentle ? 'text-amber-700' : 'text-gray-500'}`}>
                Standard
              </span>
              {!gentle && (
                <span className="text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded font-medium">Active</span>
              )}
            </div>
            <p className="text-xs text-gray-700 leading-relaxed">
              We kindly request that you review the time entries and detailed notes above and indicate any and all concerns you may have <strong>immediately</strong>.
              If we do not receive a response within <strong>three (3) business days</strong> of this report, we will presume the time is accepted as reported and will confirm it as billable.
            </p>
          </div>

          {/* Gentle Preview */}
          <div className={`rounded-lg border-2 p-4 ${gentle ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs font-semibold uppercase tracking-wide ${gentle ? 'text-blue-700' : 'text-gray-500'}`}>
                Gentle
              </span>
              {gentle && (
                <span className="text-xs bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded font-medium">Active</span>
              )}
            </div>
            <p className="text-xs text-gray-700 leading-relaxed">
              We kindly request that you review the time entries and detailed notes above. If you have any concerns or questions, we would appreciate a response within <strong>three business days</strong>.
              Please respond directly using the link below.
            </p>
          </div>
        </div>
      </div>

      {/* Auto-Send Monthly Invoices Toggle Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Auto-Send Monthly Invoices</h3>
            <p className="text-sm text-gray-500 mt-1">
              When enabled, invoices are automatically created and sent via QuickBooks on the 1st of each month for customers whose weekly time reports have all been accepted.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {saving === 'auto_send_invoices' && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
            {saved === 'auto_send_invoices' && <Check className="w-4 h-4 text-green-500" />}
            <button
              onClick={() => toggleSetting('auto_send_invoices', autoInvoice, setAutoInvoice)}
              disabled={saving !== null}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                autoInvoice ? 'bg-purple-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${
                  autoInvoice ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <span className={`text-sm font-medium ${!autoInvoice ? 'text-gray-900' : 'text-gray-400'}`}>Off</span>
          <span className="text-gray-300">/</span>
          <span className={`text-sm font-medium ${autoInvoice ? 'text-purple-700' : 'text-gray-400'}`}>On</span>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-800">
              Only customers with <strong>ALL</strong> weeks in the billing month marked as &ldquo;accepted&rdquo; (no disputes or pending reviews) will be invoiced automatically.
              Customers without email addresses or with any unresolved weeks will be skipped.
            </p>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-xs text-blue-800">
          <strong>Note:</strong> The review language setting affects all customer-facing emails: weekly reports, supplemental reports, follow-up reminders, auto-accept confirmations, and invoice courtesy notifications.
          The auto-accept behavior (3 business days) remains the same regardless of which language tone is selected.
        </p>
      </div>
    </div>
  );
}
