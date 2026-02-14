'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fmtMoney, getMonday, fmtIsoDate as fmt } from '@/lib/utils';

interface WeekSnapshot {
  week_start: string;
  billable_revenue: number;
  labor_cost: number;
  non_payroll_overhead: number;
  billable_hours: number;
  total_hours: number;
  utilization_percent: number;
}

export function ProfitabilitySummary() {
  const [thisWeek, setThisWeek] = useState<WeekSnapshot | null>(null);
  const [lastWeek, setLastWeek] = useState<WeekSnapshot | null>(null);
  const [monthSnapshots, setMonthSnapshots] = useState<WeekSnapshot[]>([]);
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
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [thisWeekResult, lastWeekResult, monthResult] = await Promise.all([
        supabase
          .from('profitability_snapshots')
          .select('week_start,billable_revenue,labor_cost,non_payroll_overhead,billable_hours,total_hours,utilization_percent')
          .eq('week_start', fmt(monday))
          .single(),
        supabase
          .from('profitability_snapshots')
          .select('week_start,billable_revenue,labor_cost,non_payroll_overhead,billable_hours,total_hours,utilization_percent')
          .eq('week_start', fmt(lastMonday))
          .single(),
        supabase
          .from('profitability_snapshots')
          .select('week_start,billable_revenue,labor_cost,non_payroll_overhead,billable_hours,total_hours,utilization_percent')
          .gte('week_start', fmt(monthStart))
          .lte('week_start', fmt(now))
          .order('week_start', { ascending: true }),
      ]);

      if (thisWeekResult.data) setThisWeek(thisWeekResult.data as WeekSnapshot);
      if (lastWeekResult.data) setLastWeek(lastWeekResult.data as WeekSnapshot);
      if (monthResult.data) setMonthSnapshots(monthResult.data as WeekSnapshot[]);
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
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i}>
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-full"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Use last week's data as primary (current week is usually incomplete)
  const primary = lastWeek || thisWeek;
  if (!primary) {
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

  const revenue = Number(primary.billable_revenue);
  const totalCost = Number(primary.labor_cost) + Number(primary.non_payroll_overhead || 0);
  const margin = revenue - totalCost;
  const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
  const util = Number(primary.utilization_percent);

  // Month aggregates
  const monthRevenue = monthSnapshots.reduce((s, r) => s + Number(r.billable_revenue), 0);
  const monthCost = monthSnapshots.reduce((s, r) => s + Number(r.labor_cost) + Number(r.non_payroll_overhead || 0), 0);
  const monthMargin = monthRevenue - monthCost;
  const monthMarginPct = monthRevenue > 0 ? (monthMargin / monthRevenue) * 100 : 0;

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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Last Week Revenue */}
        <div>
          <p className="text-xs text-gray-500 uppercase mb-1">Last Week Revenue</p>
          <p className="text-xl font-bold text-green-600">{fmtMoney(revenue)}</p>
        </div>

        {/* Last Week Margin */}
        <div>
          <p className="text-xs text-gray-500 uppercase mb-1">Last Week Margin</p>
          <div className="flex items-center gap-1.5">
            <p className={`text-xl font-bold ${margin >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {fmtMoney(margin)}
            </p>
            {margin >= 0
              ? <TrendingUp className="w-4 h-4 text-blue-500" />
              : <TrendingDown className="w-4 h-4 text-red-500" />
            }
          </div>
          <p className={`text-xs ${marginPct >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
            {marginPct.toFixed(1)}% margin
          </p>
        </div>

        {/* Month Revenue */}
        <div>
          <p className="text-xs text-gray-500 uppercase mb-1">Month Revenue</p>
          <p className="text-xl font-bold text-green-600">{fmtMoney(monthRevenue)}</p>
          <p className="text-xs text-gray-400">{monthSnapshots.length} week{monthSnapshots.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Month Margin */}
        <div>
          <p className="text-xs text-gray-500 uppercase mb-1">Month Margin</p>
          <div className="flex items-center gap-1.5">
            <p className={`text-xl font-bold ${monthMargin >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {fmtMoney(monthMargin)}
            </p>
          </div>
          <p className={`text-xs ${monthMarginPct >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
            {monthMarginPct.toFixed(1)}% margin
          </p>
        </div>
      </div>

      {/* Mini weekly bars */}
      {monthSnapshots.length > 1 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500 uppercase mb-2">Weekly Margin Trend</p>
          <div className="flex items-end gap-1 h-12">
            {monthSnapshots.map((s, i) => {
              const rev = Number(s.billable_revenue);
              const cost = Number(s.labor_cost) + Number(s.non_payroll_overhead || 0);
              const m = rev - cost;
              const maxAbs = Math.max(...monthSnapshots.map(snap => {
                const r = Number(snap.billable_revenue);
                const c = Number(snap.labor_cost) + Number(snap.non_payroll_overhead || 0);
                return Math.abs(r - c);
              }));
              const height = maxAbs > 0 ? Math.max(4, Math.abs(m) / maxAbs * 48) : 4;
              const isPositive = m >= 0;

              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col justify-end items-center"
                  title={`${s.week_start}: ${fmtMoney(m)}`}
                >
                  <div
                    className={`w-full rounded-sm ${isPositive ? 'bg-blue-400' : 'bg-red-400'}`}
                    style={{ height: `${height}px` }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
