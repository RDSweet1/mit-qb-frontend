'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ClipboardCheck, RefreshCw, Loader2, Search, Filter } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { supabase, callEdgeFunction } from '@/lib/supabaseClient';
import { useMsal } from '@azure/msal-react';
import DailyReviewTable from '@/components/daily-review/DailyReviewTable';
import type { DailyReviewTransaction } from '@/lib/types';

export default function DailyReviewPage() {
  const { accounts } = useMsal();
  const userEmail = accounts[0]?.username || '';

  const [transactions, setTransactions] = useState<DailyReviewTransaction[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return {
      start: weekAgo.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
    };
  });

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    const [txnResult, catResult] = await Promise.all([
      supabase
        .from('daily_review_transactions')
        .select('*')
        .gte('txn_date', dateRange.start)
        .lte('txn_date', dateRange.end)
        .order('txn_date', { ascending: false })
        .order('total_amount', { ascending: false }),
      supabase
        .from('overhead_categories')
        .select('name')
        .order('display_order'),
    ]);

    if (txnResult.data) {
      setTransactions(txnResult.data);
      // Get last synced time
      const synced = txnResult.data.reduce((latest: string | null, t) => {
        if (!latest || (t.synced_at && t.synced_at > latest)) return t.synced_at;
        return latest;
      }, null);
      setLastSynced(synced);
    }

    if (catResult.data) {
      setCategories(catResult.data.map(c => c.name));
    }

    setLoading(false);
  }, [dateRange]);

  useEffect(() => { loadData(); }, [loadData]);

  // Sync from QB
  async function handleSync() {
    setSyncing(true);
    try {
      const result = await callEdgeFunction('sync-daily-review', {
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      if (result?.success) {
        await loadData();
      } else {
        console.error('Sync failed:', result?.error);
      }
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setSyncing(false);
    }
  }

  // Summary stats
  const stats = useMemo(() => {
    const pending = transactions.filter(t => t.review_status === 'pending').length;
    const reviewed = transactions.filter(t => t.review_status === 'reviewed').length;
    const flagged = transactions.filter(t => t.review_status === 'flagged').length;
    const todayTotal = transactions
      .filter(t => t.txn_date === new Date().toISOString().split('T')[0])
      .reduce((s, t) => s + Number(t.total_amount), 0);

    return { pending, reviewed, flagged, todayTotal, total: transactions.length };
  }, [transactions]);

  // Unique account names for filter
  const accountNames = useMemo(() => {
    const names = new Set<string>();
    for (const t of transactions) {
      if (t.qb_account_name) names.add(t.qb_account_name);
    }
    return Array.from(names).sort();
  }, [transactions]);

  return (
    <AppShell>
      <PageHeader
        title="Daily Financial Review"
        subtitle="Review and categorize expense transactions"
        icon={<ClipboardCheck className="w-7 h-7 text-teal-600" />}
        actions={
          <div className="flex items-center gap-3">
            {lastSynced && (
              <span className="text-xs text-gray-500">
                Last synced: {new Date(lastSynced).toLocaleString()}
              </span>
            )}
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sync from QB
            </button>
          </div>
        }
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-4">
        <div className="bg-white p-3 rounded-lg border border-gray-200">
          <span className="text-xs text-gray-500 uppercase">Pending</span>
          <p className="text-lg font-bold text-amber-600">{stats.pending}</p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-gray-200">
          <span className="text-xs text-gray-500 uppercase">Reviewed</span>
          <p className="text-lg font-bold text-green-600">{stats.reviewed}</p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-gray-200">
          <span className="text-xs text-gray-500 uppercase">Flagged</span>
          <p className="text-lg font-bold text-red-600">{stats.flagged}</p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-gray-200">
          <span className="text-xs text-gray-500 uppercase">Total</span>
          <p className="text-lg font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-gray-200">
          <span className="text-xs text-gray-500 uppercase">Today&apos;s Total</span>
          <p className="text-lg font-bold text-teal-700">
            ${stats.todayTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600">From</label>
          <input
            type="date"
            value={dateRange.start}
            onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600">To</label>
          <input
            type="date"
            value={dateRange.end}
            onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-teal-500"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="reviewed">Reviewed</option>
          <option value="auto_approved">Auto-Approved</option>
          <option value="flagged">Flagged</option>
        </select>
        <select
          value={accountFilter}
          onChange={e => setAccountFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-teal-500"
        >
          <option value="all">All Accounts</option>
          {accountNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search vendors, memos, categories..."
            className="w-full pl-10 pr-4 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
        </div>
      </div>

      {/* Main table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
        </div>
      ) : (
        <DailyReviewTable
          transactions={transactions}
          categories={categories}
          statusFilter={statusFilter}
          accountFilter={accountFilter}
          searchQuery={searchQuery}
          userEmail={userEmail}
          onRefresh={loadData}
        />
      )}
    </AppShell>
  );
}
