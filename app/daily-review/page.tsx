'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ClipboardCheck, RefreshCw, Loader2, Search, CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { supabase, callEdgeFunction } from '@/lib/supabaseClient';
import { useMsal } from '@azure/msal-react';
import DailyReviewTable from '@/components/daily-review/DailyReviewTable';
import type { DailyReviewTransaction } from '@/lib/types';
import toast from 'react-hot-toast';

export default function DailyReviewPage() {
  const { accounts } = useMsal();
  const userEmail = accounts[0]?.username || '';

  const [transactions, setTransactions] = useState<DailyReviewTransaction[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  // Completion tracking
  const [completionData, setCompletionData] = useState<Record<string, { completed: boolean; completed_by?: string; completed_at?: string }>>({});
  const [markingComplete, setMarkingComplete] = useState<string | null>(null);

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
    const [txnResult, catResult, completionResult] = await Promise.all([
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
      supabase
        .from('daily_review_completion')
        .select('*')
        .gte('review_date', dateRange.start)
        .lte('review_date', dateRange.end),
    ]);

    if (txnResult.data) {
      setTransactions(txnResult.data);
      const synced = txnResult.data.reduce((latest: string | null, t) => {
        if (!latest || (t.synced_at && t.synced_at > latest)) return t.synced_at;
        return latest;
      }, null);
      setLastSynced(synced);
    }

    if (catResult.data) {
      setCategories(catResult.data.map(c => c.name));
    }

    if (completionResult.data) {
      const map: Record<string, any> = {};
      for (const row of completionResult.data) {
        map[row.review_date] = row;
      }
      setCompletionData(map);
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
        const parts = [];
        if (result.purchases_count) parts.push(`${result.purchases_count} purchases`);
        if (result.bills_count) parts.push(`${result.bills_count} bills`);
        if (result.bill_payments_count) parts.push(`${result.bill_payments_count} bill payments`);
        if (result.transfers_count) parts.push(`${result.transfers_count} transfers`);
        if (result.vendor_credits_count) parts.push(`${result.vendor_credits_count} vendor credits`);
        toast.success(`Synced ${result.total_upserted} transactions: ${parts.join(', ')}`);
        await loadData();
      } else {
        toast.error('Sync failed: ' + (result?.error || 'Unknown error'));
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

  // Per-day breakdown for completion tracking
  const dayBreakdown = useMemo(() => {
    const days: Record<string, { total: number; pending: number; reviewed: number; flagged: number; amount: number }> = {};
    for (const t of transactions) {
      if (!days[t.txn_date]) {
        days[t.txn_date] = { total: 0, pending: 0, reviewed: 0, flagged: 0, amount: 0 };
      }
      days[t.txn_date].total++;
      days[t.txn_date].amount += Number(t.total_amount);
      if (t.review_status === 'pending') days[t.txn_date].pending++;
      else if (t.review_status === 'reviewed' || t.review_status === 'auto_approved') days[t.txn_date].reviewed++;
      else if (t.review_status === 'flagged') days[t.txn_date].flagged++;
    }
    return Object.entries(days)
      .sort(([a], [b]) => b.localeCompare(a)) // newest first
      .map(([date, counts]) => ({ date, ...counts }));
  }, [transactions]);

  // Mark a day as complete
  async function markDayComplete(date: string) {
    setMarkingComplete(date);
    try {
      const dayTxns = transactions.filter(t => t.txn_date === date);
      const pending = dayTxns.filter(t => t.review_status === 'pending').length;
      const total = dayTxns.length;

      const { error } = await supabase
        .from('daily_review_completion')
        .upsert({
          review_date: date,
          completed: true,
          completed_by: userEmail,
          completed_at: new Date().toISOString(),
          pending_count: pending,
          total_count: total,
        }, { onConflict: 'review_date' });

      if (error) {
        console.error('Failed to mark day complete:', error);
        return;
      }

      // Also mark all pending items for that day as reviewed
      if (pending > 0) {
        const pendingIds = dayTxns
          .filter(t => t.review_status === 'pending')
          .map(t => t.id);

        await supabase
          .from('daily_review_transactions')
          .update({
            review_status: 'reviewed',
            reviewed_by: userEmail,
            reviewed_at: new Date().toISOString(),
          })
          .in('id', pendingIds);
      }

      await loadData();
    } finally {
      setMarkingComplete(null);
    }
  }

  // Reopen a completed day
  async function reopenDay(date: string) {
    setMarkingComplete(date);
    try {
      await supabase
        .from('daily_review_completion')
        .update({ completed: false, completed_by: null, completed_at: null })
        .eq('review_date', date);
      await loadData();
    } finally {
      setMarkingComplete(null);
    }
  }

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

      {/* Day-by-day completion tracker */}
      {!loading && dayBreakdown.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 mb-4 overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">Daily Completion</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {dayBreakdown.map(day => {
              const isComplete = completionData[day.date]?.completed;
              const reviewedPct = day.total > 0 ? Math.round(((day.reviewed) / day.total) * 100) : 0;
              const isMarking = markingComplete === day.date;
              const dayLabel = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric',
              });

              return (
                <div key={day.date} className="flex items-center gap-4 px-4 py-2">
                  {/* Status icon */}
                  {isComplete ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : day.pending === 0 ? (
                    <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-300 flex-shrink-0" />
                  )}

                  {/* Day label */}
                  <span className="text-sm font-medium text-gray-800 w-28 flex-shrink-0">{dayLabel}</span>

                  {/* Progress bar */}
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isComplete ? 'bg-green-500' : 'bg-teal-500'}`}
                        style={{ width: `${reviewedPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Counts */}
                  <span className="text-xs text-gray-500 w-32 text-right flex-shrink-0">
                    {day.reviewed}/{day.total} reviewed
                    {day.flagged > 0 && <span className="text-red-500 ml-1">({day.flagged} flagged)</span>}
                  </span>

                  {/* Amount */}
                  <span className="text-xs font-medium text-gray-700 w-24 text-right tabular-nums flex-shrink-0">
                    ${Number(day.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>

                  {/* Action button */}
                  <div className="w-32 flex-shrink-0 text-right">
                    {isComplete ? (
                      <button
                        onClick={() => reopenDay(day.date)}
                        disabled={isMarking}
                        className="text-xs text-gray-500 hover:text-gray-700 underline disabled:opacity-50"
                      >
                        Reopen
                      </button>
                    ) : (
                      <button
                        onClick={() => markDayComplete(day.date)}
                        disabled={isMarking}
                        className="flex items-center gap-1 ml-auto px-2.5 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {isMarking ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        Mark Complete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
