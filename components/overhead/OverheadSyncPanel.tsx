'use client';

import { useState } from 'react';
import { RefreshCw, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { callEdgeFunction } from '@/lib/supabaseClient';

interface SyncResult {
  success: boolean;
  txn_count?: number;
  vendor_count?: number;
  categories?: number;
  total_annual?: number;
  weekly_amount?: number;
  materialize_only?: boolean;
  error?: string;
}

function fmtMoney(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface OverheadSyncPanelProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (d: string) => void;
  onEndDateChange: (d: string) => void;
  onSyncComplete: () => void;
}

export default function OverheadSyncPanel({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onSyncComplete,
}: OverheadSyncPanelProps) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const presets = [
    { label: 'Trailing 12mo', getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear() - 1, now.getMonth(), 1);
      return { start: start.toISOString().split('T')[0], end: now.toISOString().split('T')[0] };
    }},
    { label: 'This Year', getRange: () => {
      const now = new Date();
      return { start: `${now.getFullYear()}-01-01`, end: now.toISOString().split('T')[0] };
    }},
    { label: 'Last Year', getRange: () => {
      const y = new Date().getFullYear() - 1;
      return { start: `${y}-01-01`, end: `${y}-12-31` };
    }},
  ];

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await callEdgeFunction('sync-overhead-transactions', { startDate, endDate });
      setSyncResult(result);
      onSyncComplete();
    } catch (err: any) {
      setSyncResult({ success: false, error: err.message });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-gray-700">Period:</span>
        {presets.map(p => (
          <button
            key={p.label}
            onClick={() => {
              const range = p.getRange();
              onStartDateChange(range.start);
              onEndDateChange(range.end);
            }}
            className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            {p.label}
          </button>
        ))}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={e => onStartDateChange(e.target.value)}
            className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
          />
          <span className="text-gray-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={e => onEndDateChange(e.target.value)}
            className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
          />
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm font-medium ml-auto"
        >
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {syncing ? 'Syncing...' : 'Sync from QuickBooks'}
        </button>
      </div>

      {syncResult && (
        <div className={`rounded-lg p-4 border ${syncResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          {syncResult.success ? (
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-800">
                  Sync complete: {syncResult.txn_count} transactions from {syncResult.vendor_count} vendors
                </p>
                <p className="text-sm text-green-700 mt-1">
                  {syncResult.categories} categories &bull; Annual: {fmtMoney(syncResult.total_annual || 0)} &bull; Weekly: {fmtMoney(syncResult.weekly_amount || 0)}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{syncResult.error || 'Sync failed'}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
