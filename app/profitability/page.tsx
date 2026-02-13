'use client';

import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, TrendingUp, Download, AlertCircle, ChevronDown, ChevronRight, Loader2, LogOut, DollarSign, Settings } from 'lucide-react';
import Link from 'next/link';
import { useMsal } from '@azure/msal-react';
import { ProtectedPage } from '@/components/ProtectedPage';
import { supabase, callEdgeFunction } from '@/lib/supabaseClient';
import { format, startOfWeek, endOfWeek, addWeeks, isBefore, isAfter } from 'date-fns';
import PnlSummaryView from '@/components/profitability/PnlSummaryView';
import OverheadView from '@/components/profitability/OverheadView';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// --- Types ---

interface Snapshot {
  id: number;
  week_start: string;
  week_end: string;
  total_hours: number;
  billable_hours: number;
  overhead_hours: number;
  billable_revenue: number;
  labor_cost: number;
  overhead_cost: number;
  non_payroll_overhead: number;
  gross_margin: number;
  margin_percent: number;
  utilization_percent: number;
  breakdown_by_category: Record<string, { hours: number; cost: number }>;
  breakdown_by_employee: Record<string, {
    totalHours: number;
    billableHours: number;
    overheadHours: number;
    laborCost: number;
    revenue: number;
  }>;
  unbilled_entry_count: number;
  unbilled_hours: number;
}

type DatePreset = 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_quarter' | 'ytd' | 'custom';

// --- Helpers ---

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function fmt(d: Date): string {
  return d.toISOString().split('T')[0];
}

function fmtMoney(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPct(n: number): string {
  return n.toFixed(1) + '%';
}

function weekLabel(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00');
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  return `${format(d, 'MMM d')}\u2013${format(end, 'd')}`;
}

/** Generate all Monday-start weeks that overlap the given date range */
function getWeeksInRange(start: string, end: string): string[] {
  const weeks: string[] = [];
  let monday = getMonday(new Date(start + 'T00:00:00'));
  const endDate = new Date(end + 'T00:00:00');
  while (!isAfter(monday, endDate)) {
    weeks.push(fmt(monday));
    monday = addWeeks(monday, 1);
  }
  return weeks;
}

// --- Component ---

export default function ProfitabilityPage() {
  const { instance, accounts } = useMsal();
  const user = accounts[0];

  type ActiveTab = 'profitability' | 'pnl' | 'overhead';
  const [activeTab, setActiveTab] = useState<ActiveTab>('profitability');
  const [datePreset, setDatePreset] = useState<DatePreset>('this_month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const [showEmployees, setShowEmployees] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState('');
  const [sortCol, setSortCol] = useState<string>('week_start');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Initialize date range
  useEffect(() => {
    applyPreset('this_month');
  }, []);

  function applyPreset(preset: DatePreset) {
    const now = new Date();
    let start: Date;
    let end: Date;
    switch (preset) {
      case 'this_week':
        start = getMonday(now);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        break;
      case 'last_week':
        start = getMonday(now);
        start.setDate(start.getDate() - 7);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        break;
      case 'this_month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'last_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'this_quarter': {
        const q = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), q * 3, 1);
        end = new Date(now.getFullYear(), q * 3 + 3, 0);
        break;
      }
      case 'ytd':
        start = new Date(now.getFullYear(), 0, 1);
        end = now;
        break;
      default:
        return;
    }
    setDatePreset(preset);
    setStartDate(fmt(start));
    setEndDate(fmt(end));
  }

  // Load snapshots when dates change
  useEffect(() => {
    if (!startDate || !endDate) return;
    setLoading(true);
    // Fetch all snapshots whose week overlaps the range
    const rangeMonday = fmt(getMonday(new Date(startDate + 'T00:00:00')));
    supabase
      .from('profitability_snapshots')
      .select('*')
      .gte('week_start', rangeMonday)
      .lte('week_start', endDate)
      .order('week_start', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('Error loading snapshots:', error);
        setSnapshots((data || []) as Snapshot[]);
        setLoading(false);
      });
  }, [startDate, endDate]);

  // Aggregated summary stats
  const summary = useMemo(() => {
    const totalRevenue = snapshots.reduce((s, r) => s + Number(r.billable_revenue), 0);
    const totalLabor = snapshots.reduce((s, r) => s + Number(r.labor_cost), 0);
    const totalNonPayroll = snapshots.reduce((s, r) => s + Number(r.non_payroll_overhead || 0), 0);
    const totalCost = totalLabor + totalNonPayroll;
    const grossMargin = totalRevenue - totalCost;
    const marginPct = totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0;
    const totalHours = snapshots.reduce((s, r) => s + Number(r.total_hours), 0);
    const billableHours = snapshots.reduce((s, r) => s + Number(r.billable_hours), 0);
    const utilPct = totalHours > 0 ? (billableHours / totalHours) * 100 : 0;
    return { totalRevenue, totalCost, grossMargin, marginPct, utilPct, totalHours, billableHours };
  }, [snapshots]);

  // Chart data
  const chartData = useMemo(() => {
    return snapshots.map(s => ({
      week: weekLabel(s.week_start),
      Revenue: Number(s.billable_revenue),
      'Total Cost': Number(s.labor_cost) + Number(s.non_payroll_overhead || 0),
      'Gross Margin': Number(s.billable_revenue) - Number(s.labor_cost) - Number(s.non_payroll_overhead || 0),
      'Utilization %': Number(s.utilization_percent),
    }));
  }, [snapshots]);

  // Employee aggregate
  const employeeData = useMemo(() => {
    const map: Record<string, { totalHours: number; billableHours: number; revenue: number; laborCost: number }> = {};
    for (const s of snapshots) {
      if (!s.breakdown_by_employee) continue;
      for (const [name, data] of Object.entries(s.breakdown_by_employee)) {
        if (!map[name]) map[name] = { totalHours: 0, billableHours: 0, revenue: 0, laborCost: 0 };
        map[name].totalHours += data.totalHours || 0;
        map[name].billableHours += data.billableHours || 0;
        map[name].revenue += data.revenue || 0;
        map[name].laborCost += data.laborCost || 0;
      }
    }
    return Object.entries(map)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [snapshots]);

  // Missing weeks
  const missingWeeks = useMemo(() => {
    if (!startDate || !endDate) return [];
    const allWeeks = getWeeksInRange(startDate, endDate);
    const existingSet = new Set(snapshots.map(s => s.week_start));
    // Don't flag future weeks
    const today = fmt(new Date());
    return allWeeks.filter(w => !existingSet.has(w) && w <= today);
  }, [startDate, endDate, snapshots]);

  // Generate missing weeks
  async function generateMissing() {
    setGenerating(true);
    for (let i = 0; i < missingWeeks.length; i++) {
      const ws = missingWeeks[i];
      const we = fmt(new Date(new Date(ws + 'T00:00:00').getTime() + 6 * 86400000));
      setGenerateProgress(`Generating week ${i + 1} of ${missingWeeks.length}: ${weekLabel(ws)}...`);
      try {
        await callEdgeFunction('weekly-profitability-report', { weekStart: ws, weekEnd: we });
      } catch (err) {
        console.error(`Failed to generate week ${ws}:`, err);
      }
    }
    setGenerateProgress('');
    setGenerating(false);
    // Reload snapshots
    const rangeMonday = fmt(getMonday(new Date(startDate + 'T00:00:00')));
    const { data } = await supabase
      .from('profitability_snapshots')
      .select('*')
      .gte('week_start', rangeMonday)
      .lte('week_start', endDate)
      .order('week_start', { ascending: true });
    setSnapshots((data || []) as Snapshot[]);
  }

  // Sorting
  function handleSort(col: string) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  }

  const sortedSnapshots = useMemo(() => {
    return [...snapshots].sort((a, b) => {
      let av: number, bv: number;
      switch (sortCol) {
        case 'week_start': return sortDir === 'asc' ? a.week_start.localeCompare(b.week_start) : b.week_start.localeCompare(a.week_start);
        case 'total_hours': av = Number(a.total_hours); bv = Number(b.total_hours); break;
        case 'billable_hours': av = Number(a.billable_hours); bv = Number(b.billable_hours); break;
        case 'utilization_percent': av = Number(a.utilization_percent); bv = Number(b.utilization_percent); break;
        case 'billable_revenue': av = Number(a.billable_revenue); bv = Number(b.billable_revenue); break;
        case 'labor_cost': av = Number(a.labor_cost); bv = Number(b.labor_cost); break;
        case 'non_payroll_overhead': av = Number(a.non_payroll_overhead || 0); bv = Number(b.non_payroll_overhead || 0); break;
        case 'total_cost': av = Number(a.labor_cost) + Number(a.non_payroll_overhead || 0); bv = Number(b.labor_cost) + Number(b.non_payroll_overhead || 0); break;
        case 'gross_margin': av = Number(a.billable_revenue) - Number(a.labor_cost) - Number(a.non_payroll_overhead || 0); bv = Number(b.billable_revenue) - Number(b.labor_cost) - Number(b.non_payroll_overhead || 0); break;
        case 'margin_percent': av = Number(a.margin_percent); bv = Number(b.margin_percent); break;
        default: return 0;
      }
      return sortDir === 'asc' ? av! - bv! : bv! - av!;
    });
  }, [snapshots, sortCol, sortDir]);

  // Export CSV
  function exportCsv() {
    const header = 'Week Start,Week End,Hours,Billable Hours,Utilization %,Revenue,Labor Cost,Overhead,Total Cost,Margin,Margin %\n';
    const rows = snapshots.map(s => {
      const totalCost = Number(s.labor_cost) + Number(s.non_payroll_overhead || 0);
      const margin = Number(s.billable_revenue) - totalCost;
      const marginPct = Number(s.billable_revenue) > 0 ? (margin / Number(s.billable_revenue) * 100) : 0;
      return `${s.week_start},${s.week_end},${Number(s.total_hours).toFixed(1)},${Number(s.billable_hours).toFixed(1)},${Number(s.utilization_percent).toFixed(1)},${Number(s.billable_revenue).toFixed(2)},${Number(s.labor_cost).toFixed(2)},${Number(s.non_payroll_overhead || 0).toFixed(2)},${totalCost.toFixed(2)},${margin.toFixed(2)},${marginPct.toFixed(1)}`;
    }).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `profitability-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const SortHeader = ({ col, label, align }: { col: string; label: string; align?: string }) => (
    <th
      className={`px-3 py-3 text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:text-gray-900 select-none ${align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={() => handleSort(col)}
    >
      {label} {sortCol === col ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : ''}
    </th>
  );

  const presets: { key: DatePreset; label: string }[] = [
    { key: 'this_week', label: 'This Week' },
    { key: 'last_week', label: 'Last Week' },
    { key: 'this_month', label: 'This Month' },
    { key: 'last_month', label: 'Last Month' },
    { key: 'this_quarter', label: 'This Quarter' },
    { key: 'ytd', label: 'YTD' },
  ];

  return (
    <ProtectedPage>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/" className="text-gray-600 hover:text-gray-900">
                  <ArrowLeft className="w-6 h-6" />
                </Link>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">Profitability</h1>
                    <p className="text-sm text-gray-600">Weekly P&L trends and overhead analysis</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right hidden md:block">
                  <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                  <p className="text-xs text-gray-500">{user?.username}</p>
                </div>
                <button
                  onClick={() => instance.logoutPopup()}
                  className="px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Date Range Controls */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-gray-700">Period:</span>
              {presets.map(p => (
                <button
                  key={p.key}
                  onClick={() => applyPreset(p.key)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    datePreset === p.key
                      ? 'bg-purple-100 text-purple-800 font-semibold'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <div className="flex items-center gap-2 ml-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={e => { setStartDate(e.target.value); setDatePreset('custom'); }}
                  className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
                />
                <span className="text-gray-400">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => { setEndDate(e.target.value); setDatePreset('custom'); }}
                  className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
                />
              </div>
              <div className="ml-auto">
                <button
                  onClick={exportCsv}
                  disabled={snapshots.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 text-sm"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>
            </div>
          </div>

          {/* Tab Bar */}
          <div className="flex gap-1 mb-6">
            {([
              { key: 'profitability' as ActiveTab, label: 'Profitability', icon: TrendingUp },
              { key: 'pnl' as ActiveTab, label: 'P&L Summary', icon: DollarSign },
              { key: 'overhead' as ActiveTab, label: 'Overhead', icon: Settings },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab.key
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* P&L Summary Tab */}
          {activeTab === 'pnl' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <PnlSummaryView startDate={startDate} endDate={endDate} />
            </div>
          )}

          {/* Overhead Tab */}
          {activeTab === 'overhead' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <OverheadView />
            </div>
          )}

          {/* Profitability Tab (existing content) */}
          {activeTab === 'profitability' && <>
          {/* Missing Weeks Notice */}
          {missingWeeks.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  <strong>{missingWeeks.length}</strong> week{missingWeeks.length > 1 ? 's' : ''} in this range {missingWeeks.length > 1 ? 'have' : 'has'} no snapshot data.
                </p>
              </div>
              <button
                onClick={generateMissing}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {generating ? generateProgress || 'Generating...' : 'Generate Missing'}
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : snapshots.length === 0 ? (
            <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-200 text-center">
              <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Profitability Data</h3>
              <p className="text-sm text-gray-600">No snapshots found for this period. Use "Generate Missing" above to create them.</p>
            </div>
          ) : (
            <>
              {/* Summary Stat Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                  <p className="text-2xl font-bold text-green-600">{fmtMoney(summary.totalRevenue)}</p>
                  <p className="text-xs text-gray-500 uppercase mt-1">Total Revenue</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                  <p className="text-2xl font-bold text-red-600">{fmtMoney(summary.totalCost)}</p>
                  <p className="text-xs text-gray-500 uppercase mt-1">Total Cost</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                  <p className={`text-2xl font-bold ${summary.grossMargin >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {fmtMoney(summary.grossMargin)}
                  </p>
                  <p className="text-xs text-gray-500 uppercase mt-1">Gross Margin ({fmtPct(summary.marginPct)})</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                  <p className="text-2xl font-bold text-purple-600">{fmtPct(summary.utilPct)}</p>
                  <p className="text-xs text-gray-500 uppercase mt-1">Avg Utilization</p>
                </div>
              </div>

              {/* Trend Chart */}
              {chartData.length > 1 && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Trend</h3>
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="left" tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
                      <Tooltip
                        formatter={(value: any, name: any) => {
                          if (name === 'Utilization %') return [fmtPct(Number(value)), name];
                          return [fmtMoney(Number(value)), name];
                        }}
                      />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="Revenue" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                      <Line yAxisId="left" type="monotone" dataKey="Total Cost" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
                      <Line yAxisId="left" type="monotone" dataKey="Gross Margin" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                      <Line yAxisId="right" type="monotone" dataKey="Utilization %" stroke="#9333ea" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Weekly Detail Table */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Weekly Detail</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-3 py-3 w-8"></th>
                        <SortHeader col="week_start" label="Week" />
                        <SortHeader col="total_hours" label="Hours" align="right" />
                        <SortHeader col="billable_hours" label="Billable" align="right" />
                        <SortHeader col="utilization_percent" label="Util%" align="right" />
                        <SortHeader col="billable_revenue" label="Revenue" align="right" />
                        <SortHeader col="labor_cost" label="Labor" align="right" />
                        <SortHeader col="non_payroll_overhead" label="Overhead" align="right" />
                        <SortHeader col="total_cost" label="Total Cost" align="right" />
                        <SortHeader col="gross_margin" label="Margin" align="right" />
                        <SortHeader col="margin_percent" label="Margin%" align="right" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {sortedSnapshots.map(s => {
                        const totalCost = Number(s.labor_cost) + Number(s.non_payroll_overhead || 0);
                        const margin = Number(s.billable_revenue) - totalCost;
                        const marginPct = Number(s.billable_revenue) > 0 ? (margin / Number(s.billable_revenue) * 100) : 0;
                        const isExpanded = expandedWeek === s.week_start;
                        return (
                          <SnapshotRow
                            key={s.id}
                            snapshot={s}
                            totalCost={totalCost}
                            margin={margin}
                            marginPct={marginPct}
                            isExpanded={isExpanded}
                            onToggle={() => setExpandedWeek(isExpanded ? null : s.week_start)}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Employee Breakdown */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <button
                  className="w-full px-6 py-4 flex items-center justify-between border-b border-gray-200 hover:bg-gray-50 transition-colors"
                  onClick={() => setShowEmployees(!showEmployees)}
                >
                  <h3 className="text-lg font-semibold text-gray-900">Employee Breakdown</h3>
                  {showEmployees ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />}
                </button>
                {showEmployees && (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Employee</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Total Hours</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Billable Hours</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Revenue</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Labor Cost</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Margin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {employeeData.map(emp => {
                          const empMargin = emp.revenue - emp.laborCost;
                          return (
                            <tr key={emp.name} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">{emp.name}</td>
                              <td className="px-4 py-3 text-sm text-gray-900 text-right">{emp.totalHours.toFixed(1)}</td>
                              <td className="px-4 py-3 text-sm text-gray-900 text-right">{emp.billableHours.toFixed(1)}</td>
                              <td className="px-4 py-3 text-sm text-green-700 text-right font-medium">{fmtMoney(emp.revenue)}</td>
                              <td className="px-4 py-3 text-sm text-red-700 text-right font-medium">{fmtMoney(emp.laborCost)}</td>
                              <td className={`px-4 py-3 text-sm text-right font-medium ${empMargin >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                                {fmtMoney(empMargin)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
          </>}
        </main>
      </div>
    </ProtectedPage>
  );
}

// Sub-component: expandable snapshot row
function SnapshotRow({ snapshot: s, totalCost, margin, marginPct, isExpanded, onToggle }: {
  snapshot: Snapshot;
  totalCost: number;
  margin: number;
  marginPct: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const categories = s.breakdown_by_category || {};
  const employees = s.breakdown_by_employee || {};
  const hasCategoryData = Object.keys(categories).length > 0;
  const hasEmployeeData = Object.keys(employees).length > 0;

  return (
    <>
      <tr className="hover:bg-gray-50 cursor-pointer" onClick={onToggle}>
        <td className="px-3 py-3 text-center">
          {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </td>
        <td className="px-3 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{weekLabel(s.week_start)}</td>
        <td className="px-3 py-3 text-sm text-gray-900 text-right">{Number(s.total_hours).toFixed(1)}</td>
        <td className="px-3 py-3 text-sm text-gray-900 text-right">{Number(s.billable_hours).toFixed(1)}</td>
        <td className="px-3 py-3 text-sm text-gray-900 text-right">{fmtPct(Number(s.utilization_percent))}</td>
        <td className="px-3 py-3 text-sm text-green-700 text-right font-medium">{fmtMoney(Number(s.billable_revenue))}</td>
        <td className="px-3 py-3 text-sm text-red-700 text-right">{fmtMoney(Number(s.labor_cost))}</td>
        <td className="px-3 py-3 text-sm text-red-700 text-right">{fmtMoney(Number(s.non_payroll_overhead || 0))}</td>
        <td className="px-3 py-3 text-sm text-red-700 text-right font-medium">{fmtMoney(totalCost)}</td>
        <td className={`px-3 py-3 text-sm text-right font-medium ${margin >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{fmtMoney(margin)}</td>
        <td className={`px-3 py-3 text-sm text-right font-medium ${marginPct >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{fmtPct(marginPct)}</td>
      </tr>
      {isExpanded && (hasCategoryData || hasEmployeeData) && (
        <tr>
          <td colSpan={11} className="bg-gray-50 px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Category breakdown */}
              {hasCategoryData && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Overhead by Category</h4>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="py-1 text-left text-xs text-gray-500 uppercase">Category</th>
                        <th className="py-1 text-right text-xs text-gray-500 uppercase">Hours</th>
                        <th className="py-1 text-right text-xs text-gray-500 uppercase">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(categories).map(([cat, data]) => (
                        <tr key={cat} className="border-b border-gray-100">
                          <td className="py-1 capitalize text-gray-700">{cat}</td>
                          <td className="py-1 text-right text-gray-900">{data.hours.toFixed(1)}</td>
                          <td className="py-1 text-right text-gray-900">{fmtMoney(data.cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {/* Employee breakdown for this week */}
              {hasEmployeeData && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Employee Detail</h4>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="py-1 text-left text-xs text-gray-500 uppercase">Employee</th>
                        <th className="py-1 text-right text-xs text-gray-500 uppercase">Hours</th>
                        <th className="py-1 text-right text-xs text-gray-500 uppercase">Billable</th>
                        <th className="py-1 text-right text-xs text-gray-500 uppercase">Revenue</th>
                        <th className="py-1 text-right text-xs text-gray-500 uppercase">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(employees)
                        .sort(([, a], [, b]) => b.revenue - a.revenue)
                        .map(([name, data]) => (
                          <tr key={name} className="border-b border-gray-100">
                            <td className="py-1 text-gray-700">{name}</td>
                            <td className="py-1 text-right text-gray-900">{data.totalHours.toFixed(1)}</td>
                            <td className="py-1 text-right text-gray-900">{data.billableHours.toFixed(1)}</td>
                            <td className="py-1 text-right text-green-700">{fmtMoney(data.revenue)}</td>
                            <td className="py-1 text-right text-red-700">{fmtMoney(data.laborCost)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
