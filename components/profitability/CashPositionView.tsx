'use client';

import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Loader2, CheckCircle, AlertCircle, ChevronDown, ChevronRight, DollarSign, CreditCard, TrendingUp, Clock } from 'lucide-react';
import { supabase, callEdgeFunction } from '@/lib/supabaseClient';
import { fmtMoney, fmtPct, weekLabel, getMonday, fmtIsoDate as fmt } from '@/lib/utils';
import type { QBPayment, QBInvoiceBalance, CashPositionWeek } from '@/lib/types';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';

interface CashPositionViewProps {
  startDate: string;
  endDate: string;
}

interface SyncResult {
  success: boolean;
  payments_count?: number;
  deposits_count?: number;
  invoices_count?: number;
  error?: string;
}

export default function CashPositionView({ startDate, endDate }: CashPositionViewProps) {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [payments, setPayments] = useState<QBPayment[]>([]);
  const [invoiceBillings, setInvoiceBillings] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [arBalances, setArBalances] = useState<QBInvoiceBalance[]>([]);
  const [showAging, setShowAging] = useState(false);

  // Load all data
  useEffect(() => {
    if (!startDate || !endDate) return;
    setLoading(true);

    const rangeMonday = fmt(getMonday(new Date(startDate + 'T00:00:00')));

    Promise.all([
      // Payments in range
      supabase
        .from('qb_payments')
        .select('*')
        .gte('txn_date', rangeMonday)
        .lte('txn_date', endDate)
        .order('txn_date', { ascending: true }),
      // Invoices created in range (from invoice_log)
      supabase
        .from('invoice_log')
        .select('*')
        .gte('period_start', rangeMonday)
        .lte('period_start', endDate)
        .eq('status', 'created'),
      // Profitability snapshots (labor + overhead)
      supabase
        .from('profitability_snapshots')
        .select('week_start, labor_cost, non_payroll_overhead, billable_revenue')
        .gte('week_start', rangeMonday)
        .lte('week_start', endDate)
        .order('week_start', { ascending: true }),
      // Outstanding A/R (balance > 0)
      supabase
        .from('qb_invoice_balances')
        .select('*')
        .gt('balance', 0)
        .order('due_date', { ascending: true }),
    ]).then(([paymentsRes, invoicesRes, snapshotsRes, arRes]) => {
      setPayments((paymentsRes.data || []) as QBPayment[]);
      setInvoiceBillings(invoicesRes.data || []);
      setSnapshots(snapshotsRes.data || []);
      setArBalances((arRes.data || []) as QBInvoiceBalance[]);
      setLoading(false);
    });
  }, [startDate, endDate]);

  // Sync handler
  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await callEdgeFunction('sync-payments', { startDate, endDate });
      setSyncResult(result);
      // Reload data after sync
      const rangeMonday = fmt(getMonday(new Date(startDate + 'T00:00:00')));
      const [paymentsRes, arRes] = await Promise.all([
        supabase
          .from('qb_payments')
          .select('*')
          .gte('txn_date', rangeMonday)
          .lte('txn_date', endDate)
          .order('txn_date', { ascending: true }),
        supabase
          .from('qb_invoice_balances')
          .select('*')
          .gt('balance', 0)
          .order('due_date', { ascending: true }),
      ]);
      setPayments((paymentsRes.data || []) as QBPayment[]);
      setArBalances((arRes.data || []) as QBInvoiceBalance[]);
    } catch (err: any) {
      setSyncResult({ success: false, error: err.message });
    } finally {
      setSyncing(false);
    }
  }

  // Build weekly data with running YTD totals
  const weeklyData = useMemo<CashPositionWeek[]>(() => {
    // Index payments by week
    const paymentsByWeek: Record<string, number> = {};
    for (const p of payments) {
      const wk = fmt(getMonday(new Date(p.txn_date + 'T00:00:00')));
      paymentsByWeek[wk] = (paymentsByWeek[wk] || 0) + Number(p.total_amount);
    }

    // Index invoice billings by week (using period_start as proxy for week)
    const billedByWeek: Record<string, number> = {};
    for (const inv of invoiceBillings) {
      const wk = fmt(getMonday(new Date((inv.period_start || inv.created_at?.split('T')[0]) + 'T00:00:00')));
      billedByWeek[wk] = (billedByWeek[wk] || 0) + Number(inv.total_amount || 0);
    }

    // Index snapshots by week
    const snapshotByWeek: Record<string, { labor: number; overhead: number; revenue: number }> = {};
    for (const s of snapshots) {
      snapshotByWeek[s.week_start] = {
        labor: Number(s.labor_cost || 0),
        overhead: Number(s.non_payroll_overhead || 0),
        revenue: Number(s.billable_revenue || 0),
      };
    }

    // Collect all weeks
    const allWeeks = new Set<string>();
    Object.keys(paymentsByWeek).forEach(w => allWeeks.add(w));
    Object.keys(billedByWeek).forEach(w => allWeeks.add(w));
    Object.keys(snapshotByWeek).forEach(w => allWeeks.add(w));

    const sortedWeeks = Array.from(allWeeks).sort();

    let ytdBilled = 0, ytdReceived = 0, ytdExpenses = 0;

    return sortedWeeks.map(weekStart => {
      const snap = snapshotByWeek[weekStart];
      // Use invoice_log for billed, fall back to snapshot billable_revenue
      const billed = billedByWeek[weekStart] || snap?.revenue || 0;
      const received = paymentsByWeek[weekStart] || 0;
      const labor = snap?.labor || 0;
      const overhead = snap?.overhead || 0;
      const expenses = labor + overhead;
      const net = received - expenses;

      ytdBilled += billed;
      ytdReceived += received;
      ytdExpenses += expenses;
      const ytdNet = ytdReceived - ytdExpenses;

      const collectionPct = ytdBilled > 0 ? (ytdReceived / ytdBilled) * 100 : 0;
      const expenseRatioPct = ytdReceived > 0 ? (ytdExpenses / ytdReceived) * 100 : 0;

      return {
        weekStart,
        billed,
        received,
        labor,
        overhead,
        expenses,
        net,
        ytdBilled,
        ytdReceived,
        ytdExpenses,
        ytdNet,
        collectionPct,
        expenseRatioPct,
      };
    });
  }, [payments, invoiceBillings, snapshots]);

  // Summary totals
  const summary = useMemo(() => {
    const last = weeklyData.length > 0 ? weeklyData[weeklyData.length - 1] : null;
    const totalAR = arBalances.reduce((s, inv) => s + Number(inv.balance), 0);
    return {
      ytdBilled: last?.ytdBilled || 0,
      ytdReceived: last?.ytdReceived || 0,
      collectionPct: last?.collectionPct || 0,
      totalAR,
    };
  }, [weeklyData, arBalances]);

  // A/R Aging buckets
  const arAging = useMemo(() => {
    const today = new Date();
    const buckets = { current: 0, days31_60: 0, days61_90: 0, days90plus: 0 };
    const bucketItems: Record<string, QBInvoiceBalance[]> = {
      current: [], days31_60: [], days61_90: [], days90plus: [],
    };

    for (const inv of arBalances) {
      const dueDate = inv.due_date ? new Date(inv.due_date + 'T00:00:00') : new Date(inv.txn_date + 'T00:00:00');
      const daysOld = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      const bal = Number(inv.balance);

      if (daysOld <= 30) {
        buckets.current += bal;
        bucketItems.current.push(inv);
      } else if (daysOld <= 60) {
        buckets.days31_60 += bal;
        bucketItems.days31_60.push(inv);
      } else if (daysOld <= 90) {
        buckets.days61_90 += bal;
        bucketItems.days61_90.push(inv);
      } else {
        buckets.days90plus += bal;
        bucketItems.days90plus.push(inv);
      }
    }

    return { buckets, bucketItems };
  }, [arBalances]);

  // Chart data
  const chartData = useMemo(() => {
    return weeklyData.map(w => ({
      week: weekLabel(w.weekStart),
      Billed: w.billed,
      Received: w.received,
      Expenses: w.expenses,
      'YTD Net': w.ytdNet,
    }));
  }, [weeklyData]);

  function collectionColor(pct: number): string {
    if (pct >= 90) return 'text-green-700';
    if (pct >= 70) return 'text-amber-700';
    return 'text-red-700';
  }

  function collectionBg(pct: number): string {
    if (pct >= 90) return 'bg-green-100 text-green-800';
    if (pct >= 70) return 'bg-amber-100 text-amber-800';
    return 'bg-red-100 text-red-800';
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* A. Sync Panel */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Payment & Invoice Sync</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Pulls payments, deposits, and invoice balances from QuickBooks
            </p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {syncing ? 'Syncing...' : 'Sync Payments'}
          </button>
        </div>

        {syncResult && (
          <div className={`mt-3 rounded-lg p-3 border ${syncResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            {syncResult.success ? (
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-800">
                  Synced {syncResult.payments_count} payments, {syncResult.deposits_count} deposits, {syncResult.invoices_count} invoices
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{syncResult.error || 'Sync failed'}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* B. Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-green-600" />
            <span className="text-xs text-gray-500 uppercase font-semibold">YTD Billed</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{fmtMoney(summary.ytdBilled)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-4 h-4 text-blue-600" />
            <span className="text-xs text-gray-500 uppercase font-semibold">YTD Received</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{fmtMoney(summary.ytdReceived)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-purple-600" />
            <span className="text-xs text-gray-500 uppercase font-semibold">Collection Rate</span>
          </div>
          <p className={`text-2xl font-bold ${collectionColor(summary.collectionPct)}`}>
            {fmtPct(summary.collectionPct)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <span className="text-xs text-gray-500 uppercase font-semibold">Outstanding A/R</span>
          </div>
          <p className="text-2xl font-bold text-amber-600">{fmtMoney(summary.totalAR)}</p>
        </div>
      </div>

      {/* C. A/R Aging */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <button
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          onClick={() => setShowAging(!showAging)}
        >
          <h3 className="text-lg font-semibold text-gray-900">A/R Aging</h3>
          <div className="flex items-center gap-4">
            <div className="flex gap-3 text-sm">
              <span className="text-green-700">Current: {fmtMoney(arAging.buckets.current)}</span>
              <span className="text-amber-700">31-60: {fmtMoney(arAging.buckets.days31_60)}</span>
              <span className="text-orange-700">61-90: {fmtMoney(arAging.buckets.days61_90)}</span>
              <span className="text-red-700">90+: {fmtMoney(arAging.buckets.days90plus)}</span>
            </div>
            {showAging ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />}
          </div>
        </button>

        {showAging && (
          <div className="px-6 pb-4">
            {/* Aging bar */}
            <div className="flex h-6 rounded-lg overflow-hidden mb-4">
              {summary.totalAR > 0 && (
                <>
                  {arAging.buckets.current > 0 && (
                    <div
                      className="bg-green-400 flex items-center justify-center text-xs text-white font-medium"
                      style={{ width: `${(arAging.buckets.current / summary.totalAR) * 100}%` }}
                    >
                      {fmtPct((arAging.buckets.current / summary.totalAR) * 100)}
                    </div>
                  )}
                  {arAging.buckets.days31_60 > 0 && (
                    <div
                      className="bg-amber-400 flex items-center justify-center text-xs text-white font-medium"
                      style={{ width: `${(arAging.buckets.days31_60 / summary.totalAR) * 100}%` }}
                    >
                      {fmtPct((arAging.buckets.days31_60 / summary.totalAR) * 100)}
                    </div>
                  )}
                  {arAging.buckets.days61_90 > 0 && (
                    <div
                      className="bg-orange-400 flex items-center justify-center text-xs text-white font-medium"
                      style={{ width: `${(arAging.buckets.days61_90 / summary.totalAR) * 100}%` }}
                    >
                      {fmtPct((arAging.buckets.days61_90 / summary.totalAR) * 100)}
                    </div>
                  )}
                  {arAging.buckets.days90plus > 0 && (
                    <div
                      className="bg-red-400 flex items-center justify-center text-xs text-white font-medium"
                      style={{ width: `${(arAging.buckets.days90plus / summary.totalAR) * 100}%` }}
                    >
                      {fmtPct((arAging.buckets.days90plus / summary.totalAR) * 100)}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Aging detail table */}
            {arBalances.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="py-2 text-left text-xs text-gray-500 uppercase">Customer</th>
                      <th className="py-2 text-left text-xs text-gray-500 uppercase">Invoice #</th>
                      <th className="py-2 text-right text-xs text-gray-500 uppercase">Due Date</th>
                      <th className="py-2 text-right text-xs text-gray-500 uppercase">Total</th>
                      <th className="py-2 text-right text-xs text-gray-500 uppercase">Balance</th>
                      <th className="py-2 text-center text-xs text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {arBalances.slice(0, 25).map(inv => {
                      const dueDate = inv.due_date ? new Date(inv.due_date + 'T00:00:00') : null;
                      const daysOld = dueDate ? Math.max(0, Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24))) : 0;
                      return (
                        <tr key={inv.id} className="hover:bg-gray-50">
                          <td className="py-2 text-gray-900">{inv.customer_name || 'Unknown'}</td>
                          <td className="py-2 text-gray-600">{inv.invoice_number || inv.qb_invoice_id}</td>
                          <td className="py-2 text-right text-gray-600">
                            {inv.due_date || '-'}
                          </td>
                          <td className="py-2 text-right text-gray-900">{fmtMoney(Number(inv.total_amount))}</td>
                          <td className="py-2 text-right font-medium text-amber-700">{fmtMoney(Number(inv.balance))}</td>
                          <td className="py-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                              daysOld > 90 ? 'bg-red-100 text-red-800' :
                              daysOld > 60 ? 'bg-orange-100 text-orange-800' :
                              daysOld > 30 ? 'bg-amber-100 text-amber-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {daysOld > 0 ? `${daysOld}d overdue` : 'Current'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {arBalances.length > 25 && (
                  <p className="text-xs text-gray-500 mt-2">Showing 25 of {arBalances.length} outstanding invoices</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No outstanding invoices</p>
            )}
          </div>
        )}
      </div>

      {/* D. Cash Flow Chart */}
      {chartData.length > 1 && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Cash Flow</h3>
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: any, name: any) => [fmtMoney(Number(value)), name]}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="Billed" fill="#16a34a" opacity={0.7} />
              <Bar yAxisId="left" dataKey="Received" fill="#2563eb" opacity={0.7} />
              <Bar yAxisId="left" dataKey="Expenses" fill="#dc2626" opacity={0.7} />
              <Line yAxisId="right" type="monotone" dataKey="YTD Net" stroke="#9333ea" strokeWidth={2.5} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* E. Weekly Detail Table */}
      {weeklyData.length > 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Weekly Cash Detail</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Week</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Billed</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Received</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Labor</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Overhead</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Expenses</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Net</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase bg-gray-100">YTD Billed</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase bg-gray-100">YTD Rcvd</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase bg-gray-100">YTD Exp</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase bg-gray-100">YTD Net</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase bg-gray-100">Collect%</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase bg-gray-100">Expense%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {weeklyData.map(w => (
                  <tr key={w.weekStart} className="hover:bg-gray-50">
                    <td className="px-3 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{weekLabel(w.weekStart)}</td>
                    <td className="px-3 py-3 text-sm text-green-700 text-right">{fmtMoney(w.billed)}</td>
                    <td className="px-3 py-3 text-sm text-blue-700 text-right font-medium">{fmtMoney(w.received)}</td>
                    <td className="px-3 py-3 text-sm text-red-700 text-right">{fmtMoney(w.labor)}</td>
                    <td className="px-3 py-3 text-sm text-red-700 text-right">{fmtMoney(w.overhead)}</td>
                    <td className="px-3 py-3 text-sm text-red-700 text-right font-medium">{fmtMoney(w.expenses)}</td>
                    <td className={`px-3 py-3 text-sm text-right font-medium ${w.net >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                      {fmtMoney(w.net)}
                    </td>
                    <td className="px-3 py-3 text-sm text-green-700 text-right bg-gray-50">{fmtMoney(w.ytdBilled)}</td>
                    <td className="px-3 py-3 text-sm text-blue-700 text-right bg-gray-50">{fmtMoney(w.ytdReceived)}</td>
                    <td className="px-3 py-3 text-sm text-red-700 text-right bg-gray-50">{fmtMoney(w.ytdExpenses)}</td>
                    <td className={`px-3 py-3 text-sm text-right font-bold bg-gray-50 ${w.ytdNet >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {fmtMoney(w.ytdNet)}
                    </td>
                    <td className="px-3 py-3 text-right bg-gray-50">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${collectionBg(w.collectionPct)}`}>
                        {fmtPct(w.collectionPct)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700 text-right bg-gray-50">
                      {fmtPct(w.expenseRatioPct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-200 text-center">
          <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Cash Data</h3>
          <p className="text-sm text-gray-600">Click "Sync Payments" above to pull payment data from QuickBooks, or generate profitability snapshots for this period.</p>
        </div>
      )}
    </div>
  );
}
