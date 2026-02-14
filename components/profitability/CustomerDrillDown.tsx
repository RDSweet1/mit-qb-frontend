'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, TrendingUp, Users, Wrench, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import type { CustomerProfitability } from '@/lib/types';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

interface Props {
  customerId: string;
  customerName: string;
  startDate: string;
  endDate: string;
  onClose: () => void;
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
  const fmt = (dt: Date) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(d)}\u2013${end.getDate()}`;
}

function marginColor(pct: number): string {
  if (pct < 20) return 'text-red-700';
  if (pct < 40) return 'text-amber-700';
  return 'text-green-700';
}

function marginBg(pct: number): string {
  if (pct < 20) return 'bg-red-50';
  if (pct < 40) return 'bg-amber-50';
  return 'bg-green-50';
}

export default function CustomerDrillDown({ customerId, customerName, startDate, endDate, onClose }: Props) {
  const [data, setData] = useState<CustomerProfitability[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from('customer_profitability')
      .select('*')
      .eq('qb_customer_id', customerId)
      .gte('week_start', startDate)
      .lte('week_start', endDate)
      .order('week_start', { ascending: true })
      .then(({ data: rows, error }) => {
        if (error) console.error('Error loading customer profitability:', error);
        setData((rows || []) as CustomerProfitability[]);
        setLoading(false);
      });
  }, [customerId, startDate, endDate]);

  // Aggregated stats
  const summary = useMemo(() => {
    const totalRevenue = data.reduce((s, r) => s + Number(r.billable_revenue), 0);
    const totalCost = data.reduce((s, r) => s + Number(r.labor_cost), 0);
    const totalHours = data.reduce((s, r) => s + Number(r.total_hours), 0);
    const billableHours = data.reduce((s, r) => s + Number(r.billable_hours), 0);
    const margin = totalRevenue - totalCost;
    const marginPct = totalRevenue > 0 ? (margin / totalRevenue) * 100 : 0;
    return { totalRevenue, totalCost, totalHours, billableHours, margin, marginPct };
  }, [data]);

  // Chart data
  const chartData = useMemo(() =>
    data.map(d => ({
      week: weekLabel(d.week_start),
      Revenue: Number(d.billable_revenue),
      Cost: Number(d.labor_cost),
      'Margin %': Number(d.margin_percent),
    })),
  [data]);

  // Aggregated employee data
  const employeeData = useMemo(() => {
    const map: Record<string, { hours: number; cost: number; revenue: number }> = {};
    for (const row of data) {
      if (!row.breakdown_by_employee) continue;
      for (const [name, d] of Object.entries(row.breakdown_by_employee)) {
        if (!map[name]) map[name] = { hours: 0, cost: 0, revenue: 0 };
        map[name].hours += d.hours || 0;
        map[name].cost += d.cost || 0;
        map[name].revenue += d.revenue || 0;
      }
    }
    return Object.entries(map)
      .map(([name, d]) => ({
        name,
        ...d,
        margin: d.revenue - d.cost,
        marginPct: d.revenue > 0 ? ((d.revenue - d.cost) / d.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [data]);

  // Aggregated service data
  const serviceData = useMemo(() => {
    const map: Record<string, { hours: number; revenue: number; count: number }> = {};
    for (const row of data) {
      if (!row.breakdown_by_service) continue;
      for (const [name, d] of Object.entries(row.breakdown_by_service)) {
        if (!map[name]) map[name] = { hours: 0, revenue: 0, count: 0 };
        map[name].hours += d.hours || 0;
        map[name].revenue += d.revenue || 0;
        map[name].count += d.count || 0;
      }
    }
    return Object.entries(map)
      .map(([name, d]) => ({
        name,
        ...d,
        avgRate: d.hours > 0 ? d.revenue / d.hours : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [data]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-t-2xl px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">{customerName}</h2>
            <p className="text-purple-200 text-sm">Customer Profitability Detail</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${
              summary.marginPct >= 40 ? 'bg-green-100 text-green-800' :
              summary.marginPct >= 20 ? 'bg-amber-100 text-amber-800' :
              'bg-red-100 text-red-800'
            }`}>
              {fmtPct(summary.marginPct)} margin
            </span>
            <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[calc(100vh-12rem)] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No profitability data for this customer in the selected period.
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-lg font-bold text-green-700">{fmtMoney(summary.totalRevenue)}</p>
                  <p className="text-xs text-green-600">Total Revenue</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3">
                  <p className="text-lg font-bold text-red-700">{fmtMoney(summary.totalCost)}</p>
                  <p className="text-xs text-red-600">Labor Cost</p>
                </div>
                <div className={`rounded-lg p-3 ${marginBg(summary.marginPct)}`}>
                  <p className={`text-lg font-bold ${marginColor(summary.marginPct)}`}>{fmtMoney(summary.margin)}</p>
                  <p className="text-xs text-gray-600">Margin ({fmtPct(summary.marginPct)})</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3">
                  <p className="text-lg font-bold text-purple-700">{summary.billableHours.toFixed(1)}h</p>
                  <p className="text-xs text-purple-600">Billable Hours</p>
                </div>
              </div>

              {/* Trend Chart */}
              {chartData.length > 1 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" /> Weekly Trend
                  </h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left" tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
                      <Tooltip
                        formatter={(value: any, name: any) => {
                          if (name === 'Margin %') return [fmtPct(Number(value)), name];
                          return [fmtMoney(Number(value)), name];
                        }}
                      />
                      <Legend />
                      <Bar yAxisId="left" dataKey="Revenue" fill="#16a34a" radius={[3, 3, 0, 0]} />
                      <Bar yAxisId="left" dataKey="Cost" fill="#dc2626" radius={[3, 3, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="Margin %" stroke="#9333ea" strokeWidth={2} dot={{ r: 3 }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Employee Table */}
              {employeeData.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" /> Employee Breakdown
                  </h3>
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Employee</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Hours</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Cost</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Revenue</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Margin %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {employeeData.map(emp => (
                          <tr key={emp.name} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium text-gray-900">{emp.name}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{emp.hours.toFixed(1)}</td>
                            <td className="px-3 py-2 text-right text-red-700">{fmtMoney(emp.cost)}</td>
                            <td className="px-3 py-2 text-right text-green-700">{fmtMoney(emp.revenue)}</td>
                            <td className={`px-3 py-2 text-right font-medium ${marginColor(emp.marginPct)}`}>
                              {fmtPct(emp.marginPct)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Service Item Table */}
              {serviceData.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Wrench className="w-4 h-4" /> Service Item Breakdown
                  </h3>
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Service</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Hours</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Revenue</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Avg Rate</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Entries</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {serviceData.map(si => (
                          <tr key={si.name} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium text-gray-900">{si.name}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{si.hours.toFixed(1)}</td>
                            <td className="px-3 py-2 text-right text-green-700">{fmtMoney(si.revenue)}</td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              ${si.avgRate.toFixed(0)}/hr
                            </td>
                            <td className="px-3 py-2 text-right text-gray-600">{si.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
