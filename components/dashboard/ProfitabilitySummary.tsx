'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fmtMoney, fmtPct, getMonday, fmtIsoDate as fmt } from '@/lib/utils';
import { startOfMonth, subMonths, startOfYear, subDays, startOfWeek } from 'date-fns';

interface WeekSnapshot {
  week_start: string;
  billable_revenue: number;
  labor_cost: number;
  non_payroll_overhead: number;
  billable_hours: number;
  total_hours: number;
  utilization_percent: number;
}

interface PeriodStats {
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
  weeks: number;
}

function aggregateSnapshots(snapshots: WeekSnapshot[]): PeriodStats {
  const revenue = snapshots.reduce((s, r) => s + Number(r.billable_revenue), 0);
  const cost = snapshots.reduce((s, r) => s + Number(r.labor_cost) + Number(r.non_payroll_overhead || 0), 0);
  const margin = revenue - cost;
  const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
  return { revenue, cost, margin, marginPct, weeks: snapshots.length };
}

export function ProfitabilitySummary() {
  const [lastWeekStats, setLastWeekStats] = useState<PeriodStats | null>(null);
  const [lastMonthStats, setLastMonthStats] = useState<PeriodStats | null>(null);
  const [ytdStats, setYtdStats] = useState<PeriodStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const now = new Date();
      const monday = getMonday(now);
      const lastMonday = new Date(monday);
      lastMonday.setDate(monday.getDate() - 7);

      // Last month = previous calendar month
      const lastMonthStart = startOfMonth(subMonths(now, 1));
      const lastMonthEnd = subDays(startOfMonth(now), 1);
      // YTD
      const yearStart = startOfYear(now);

      const [lastWeekResult, lastMonthResult, ytdResult] = await Promise.all([
        supabase
          .from('profitability_snapshots')
          .select('week_start,billable_revenue,labor_cost,non_payroll_overhead,billable_hours,total_hours,utilization_percent')
          .eq('week_start', fmt(lastMonday))
          .single(),
        supabase
          .from('profitability_snapshots')
          .select('week_start,billable_revenue,labor_cost,non_payroll_overhead,billable_hours,total_hours,utilization_percent')
          .gte('week_start', fmt(lastMonthStart))
          .lte('week_start', fmt(lastMonthEnd))
          .order('week_start', { ascending: true }),
        supabase
          .from('profitability_snapshots')
          .select('week_start,billable_revenue,labor_cost,non_payroll_overhead,billable_hours,total_hours,utilization_percent')
          .gte('week_start', fmt(yearStart))
          .lte('week_start', fmt(now))
          .order('week_start', { ascending: true }),
      ]);

      if (lastWeekResult.data) {
        setLastWeekStats(aggregateSnapshots([lastWeekResult.data as WeekSnapshot]));
      }
      if (lastMonthResult.data && lastMonthResult.data.length > 0) {
        setLastMonthStats(aggregateSnapshots(lastMonthResult.data as WeekSnapshot[]));
      }
      if (ytdResult.data && ytdResult.data.length > 0) {
        setYtdStats(aggregateSnapshots(ytdResult.data as WeekSnapshot[]));
      }
    } catch (err) {
      console.error('Error loading profitability summary:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i}>
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-full"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const hasData = lastWeekStats || lastMonthStats || ytdStats;
  if (!hasData) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            Profitability
          </h3>
          <Link href="/profitability" className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1">
            View Details <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <p className="text-sm text-gray-500">No snapshot data yet. Visit the Profitability page to generate reports.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-purple-600" />
          Profitability
        </h3>
        <Link href="/profitability" className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1">
          View Details <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Last Week */}
        <PeriodCard label="Last Week" stats={lastWeekStats} />

        {/* Last Month */}
        <PeriodCard label="Last Month" stats={lastMonthStats} />

        {/* Year to Date */}
        <PeriodCard label="Year to Date" stats={ytdStats} />
      </div>
    </div>
  );
}

function PeriodCard({ label, stats }: { label: string; stats: PeriodStats | null }) {
  if (!stats) {
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-xs text-gray-500 uppercase font-semibold mb-2">{label}</p>
        <p className="text-sm text-gray-400">No data</p>
      </div>
    );
  }

  const isPositive = stats.margin >= 0;

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <p className="text-xs text-gray-500 uppercase font-semibold mb-3">{label}</p>
      <div className="space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-gray-500">Revenue</span>
          <span className="text-sm font-semibold text-green-600">{fmtMoney(stats.revenue)}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-gray-500">Total Cost</span>
          <span className="text-sm font-semibold text-red-600">{fmtMoney(stats.cost)}</span>
        </div>
        <div className="border-t border-gray-200 pt-2 flex justify-between items-baseline">
          <span className="text-xs text-gray-500">Net Margin</span>
          <div className="flex items-center gap-1.5">
            <span className={`text-base font-bold ${isPositive ? 'text-blue-600' : 'text-red-600'}`}>
              {fmtMoney(stats.margin)}
            </span>
            {isPositive
              ? <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
              : <TrendingDown className="w-3.5 h-3.5 text-red-500" />
            }
          </div>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-gray-500">Margin %</span>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
            stats.marginPct >= 30 ? 'bg-green-100 text-green-800' :
            stats.marginPct >= 15 ? 'bg-amber-100 text-amber-800' :
            'bg-red-100 text-red-800'
          }`}>
            {fmtPct(stats.marginPct)}
          </span>
        </div>
        {stats.weeks > 1 && (
          <p className="text-xs text-gray-400 pt-1">{stats.weeks} weeks</p>
        )}
      </div>
    </div>
  );
}
