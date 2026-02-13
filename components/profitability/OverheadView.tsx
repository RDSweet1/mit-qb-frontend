'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Loader2, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { supabase, callEdgeFunction } from '@/lib/supabaseClient';

interface OverheadItem {
  id: number;
  category: string;
  vendor: string;
  annual_amount: number;
  frequency: string;
  notes: string | null;
  source: string | null;
  qb_account_name: string | null;
  qb_account_id: string | null;
  last_synced_at: string | null;
  is_active: boolean;
}

interface SyncResult {
  success: boolean;
  created: number;
  updated: number;
  total_annual: number;
  weekly_amount: number;
  items: Array<{ name: string; category: string; amount: number; action: string }>;
  error?: string;
}

function fmtMoney(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function OverheadView() {
  const [items, setItems] = useState<OverheadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState('');

  async function loadItems() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('overhead_line_items')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('annual_amount', { ascending: false });

    if (err) {
      setError(err.message);
    } else {
      setItems(data || []);
    }
    setLoading(false);
  }

  useEffect(() => { loadItems(); }, []);

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    setError('');

    try {
      const year = new Date().getFullYear();
      const result = await callEdgeFunction('sync-overhead', { year });
      setSyncResult(result);
      // Reload the table
      await loadItems();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  const totalAnnual = items.reduce((s, i) => s + Number(i.annual_amount), 0);
  const weeklyAmount = totalAnnual / 52;

  // Group items by category for display
  const byCategory: Record<string, OverheadItem[]> = {};
  for (const item of items) {
    const cat = item.category || 'Other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
  }

  const sortedCategories = Object.keys(byCategory).sort();

  return (
    <div className="space-y-4">
      {/* Header with sync button and totals */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-600">
              Non-payroll overhead line items used in profitability calculations.
            </p>
            <Link
              href="/overhead"
              className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700 font-medium whitespace-nowrap"
            >
              Manage Overhead <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="flex gap-6 mt-2">
            <div>
              <span className="text-xs text-gray-500 uppercase">Annual Total</span>
              <p className="text-lg font-bold text-gray-900">{fmtMoney(totalAnnual)}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase">Weekly (/52)</span>
              <p className="text-lg font-bold text-purple-700">{fmtMoney(weeklyAmount)}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase">Items</span>
              <p className="text-lg font-bold text-gray-700">{items.length}</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap"
        >
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {syncing ? 'Syncing from QuickBooks...' : 'Update from QuickBooks'}
        </button>
      </div>

      {/* Sync result banner */}
      {syncResult && (
        <div className={`rounded-lg p-4 border ${syncResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          {syncResult.success ? (
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-800">
                  Sync complete: {syncResult.created} created, {syncResult.updated} updated
                </p>
                <p className="text-sm text-green-700 mt-1">
                  New annual total: {fmtMoney(syncResult.total_annual)} ({fmtMoney(syncResult.weekly_amount)}/week)
                </p>
                {syncResult.items.length > 0 && (
                  <ul className="mt-2 text-xs text-green-700 space-y-0.5">
                    {syncResult.items.map((item, i) => (
                      <li key={i}>
                        <span className="font-medium">{item.action === 'created' ? '+' : '~'}</span>{' '}
                        {item.name} ({item.category}): {fmtMoney(item.amount)}
                      </li>
                    ))}
                  </ul>
                )}
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

      {error && !syncResult && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Items table */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Vendor / Account</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Annual</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Weekly (/52)</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Last Synced</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedCategories.map(cat => (
                  byCategory[cat].map((item, idx) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      {idx === 0 ? (
                        <td
                          className="px-4 py-2.5 text-sm font-medium text-gray-900 align-top"
                          rowSpan={byCategory[cat].length}
                        >
                          {cat}
                        </td>
                      ) : null}
                      <td className="px-4 py-2.5 text-sm text-gray-700">{item.vendor}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-900 text-right tabular-nums font-medium">
                        {fmtMoney(Number(item.annual_amount))}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-600 text-right tabular-nums">
                        {fmtMoney(Number(item.annual_amount) / 52)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {item.source === 'vendor_txn' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                            Transactions
                          </span>
                        ) : item.source === 'qb_sync' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            QB
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            Manual
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">
                        {item.last_synced_at
                          ? new Date(item.last_synced_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : '\u2014'}
                      </td>
                    </tr>
                  ))
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200 font-semibold">
                  <td className="px-4 py-3 text-sm text-gray-900" colSpan={2}>Total ({items.length} items)</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">{fmtMoney(totalAnnual)}</td>
                  <td className="px-4 py-3 text-sm text-purple-700 text-right tabular-nums">{fmtMoney(weeklyAmount)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
