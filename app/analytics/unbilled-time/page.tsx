'use client';

import { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, Download, ExternalLink, Search } from 'lucide-react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ResponsiveTable } from '@/components/ResponsiveTable';
import { supabase } from '@/lib/supabaseClient';
import { useServiceItems } from '@/lib/hooks/useServiceItems';
import type { ServiceItem } from '@/lib/types';

interface UnbilledTimeEntry {
  id: string;
  txn_date: string;
  employee_name: string;
  customer_name: string;
  service_item_name: string | null;
  qb_item_id: string | null;
  hours: number;
  minutes: number;
  qb_customer_id: string;
}

type DatePreset = 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom';

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function fmt(d: Date): string {
  return d.toISOString().split('T')[0];
}

export default function UnbilledTimePage() {
  const [datePreset, setDatePreset] = useState<DatePreset>('last_month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [entries, setEntries] = useState<UnbilledTimeEntry[]>([]);
  const { serviceItems } = useServiceItems();
  const [loading, setLoading] = useState(true);
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterCustomer, setFilterCustomer] = useState('all');
  const [sortBy, setSortBy] = useState<'date' | 'employee' | 'customer' | 'hours'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Initialize date range
  useEffect(() => {
    applyPreset('last_month');
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
      default:
        return;
    }
    setDatePreset(preset);
    setStartDate(fmt(start));
    setEndDate(fmt(end));
  }

  // (Service items loaded by useServiceItems hook above)

  // Build service item lookup
  const itemIdByName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const si of serviceItems) {
      if (si.name) {
        map[si.name] = si.qb_item_id;
        map[si.name.toLowerCase()] = si.qb_item_id;
      }
    }
    return map;
  }, [serviceItems]);

  const itemNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const si of serviceItems) {
      map[si.qb_item_id] = si.name;
    }
    return map;
  }, [serviceItems]);

  // Resolve service item — same logic as preview-invoices
  function resolveItemId(entry: UnbilledTimeEntry): string | null {
    if (entry.qb_item_id) return entry.qb_item_id;
    if (!entry.service_item_name) return null;
    const sName = entry.service_item_name;
    let resolved = itemIdByName[sName] || itemIdByName[sName.toLowerCase()];
    if (!resolved && sName.includes(':')) {
      const leafName = sName.split(':').pop()!.trim();
      resolved = itemIdByName[leafName] || itemIdByName[leafName.toLowerCase()];
      if (!resolved) {
        const parentName = sName.split(':')[0].trim();
        resolved = itemIdByName[parentName] || itemIdByName[parentName.toLowerCase()];
      }
    }
    return resolved || null;
  }

  // Load entries when dates change
  useEffect(() => {
    if (!startDate || !endDate) return;
    setLoading(true);
    supabase
      .from('time_entries')
      .select('id, txn_date, employee_name, customer_name, service_item_name, qb_item_id, hours, minutes, qb_customer_id')
      .gte('txn_date', startDate)
      .lte('txn_date', endDate)
      .order('txn_date', { ascending: false })
      .then(({ data }) => {
        setEntries(data || []);
        setLoading(false);
      });
  }, [startDate, endDate]);

  // Filter to unbilled entries
  const unbilledEntries = useMemo(() => {
    if (serviceItems.length === 0) return [];
    return entries.filter(e => !resolveItemId(e));
  }, [entries, serviceItems, itemIdByName]);

  // Apply filters
  const filteredEntries = useMemo(() => {
    let result = unbilledEntries;
    if (filterEmployee !== 'all') {
      result = result.filter(e => e.employee_name === filterEmployee);
    }
    if (filterCustomer !== 'all') {
      result = result.filter(e => e.customer_name === filterCustomer);
    }
    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'date': cmp = a.txn_date.localeCompare(b.txn_date); break;
        case 'employee': cmp = (a.employee_name || '').localeCompare(b.employee_name || ''); break;
        case 'customer': cmp = (a.customer_name || '').localeCompare(b.customer_name || ''); break;
        case 'hours': cmp = (a.hours + a.minutes / 60) - (b.hours + b.minutes / 60); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [unbilledEntries, filterEmployee, filterCustomer, sortBy, sortDir]);

  // Unique employees and customers for filters
  const employees = useMemo(() => [...new Set(unbilledEntries.map(e => e.employee_name).filter(Boolean))].sort(), [unbilledEntries]);
  const customers = useMemo(() => [...new Set(unbilledEntries.map(e => e.customer_name).filter(Boolean))].sort(), [unbilledEntries]);

  // Summary stats
  const totalUnbilledHours = useMemo(() => filteredEntries.reduce((sum, e) => sum + e.hours + e.minutes / 60, 0), [filteredEntries]);

  // Export CSV
  function exportCsv() {
    const header = 'Date,Employee,Customer,Service Item Name,Hours,Status\n';
    const rows = filteredEntries.map(e => {
      const hrs = (e.hours + e.minutes / 60).toFixed(2);
      const status = !e.service_item_name ? 'No Cost Code' : 'Unmatched Item';
      return `${e.txn_date},"${e.employee_name}","${e.customer_name}","${e.service_item_name || ''}",${hrs},${status}`;
    }).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `unbilled-time-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <AppShell>
          <PageHeader
            title="Unbilled Time"
            subtitle="Time entries missing cost codes"
            icon={<AlertTriangle className="w-6 h-6 text-amber-600" />}
          />
          {/* Date Range Controls */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-gray-700">Period:</span>
              {(['this_week', 'last_week', 'this_month', 'last_month'] as DatePreset[]).map(preset => (
                <button
                  key={preset}
                  onClick={() => applyPreset(preset)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    datePreset === preset
                      ? 'bg-amber-100 text-amber-800 font-semibold'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {preset.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
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
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <p className="text-2xl font-bold text-red-600">{filteredEntries.length}</p>
              <p className="text-xs text-gray-500 uppercase mt-1">Unbilled Entries</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <p className="text-2xl font-bold text-red-600">{totalUnbilledHours.toFixed(1)}</p>
              <p className="text-xs text-gray-500 uppercase mt-1">Unbilled Hours</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <p className="text-2xl font-bold text-amber-600">{customers.length}</p>
              <p className="text-xs text-gray-500 uppercase mt-1">Affected Customers</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <p className="text-2xl font-bold text-amber-600">{employees.length}</p>
              <p className="text-xs text-gray-500 uppercase mt-1">Affected Employees</p>
            </div>
          </div>

          {/* Filters + Export */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-gray-400" />
                <select
                  value={filterEmployee}
                  onChange={e => setFilterEmployee(e.target.value)}
                  className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
                >
                  <option value="all">All Employees</option>
                  {employees.map(emp => (
                    <option key={emp} value={emp}>{emp}</option>
                  ))}
                </select>
              </div>
              <select
                value={filterCustomer}
                onChange={e => setFilterCustomer(e.target.value)}
                className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
              >
                <option value="all">All Customers</option>
                {customers.map(cust => (
                  <option key={cust} value={cust}>{cust}</option>
                ))}
              </select>
              <select
                value={`${sortBy}-${sortDir}`}
                onChange={e => {
                  const [by, dir] = e.target.value.split('-');
                  setSortBy(by as any);
                  setSortDir(dir as any);
                }}
                className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
              >
                <option value="date-desc">Date (Newest)</option>
                <option value="date-asc">Date (Oldest)</option>
                <option value="employee-asc">Employee (A-Z)</option>
                <option value="customer-asc">Customer (A-Z)</option>
                <option value="hours-desc">Hours (Most)</option>
              </select>
              <div className="ml-auto">
                <button
                  onClick={exportCsv}
                  disabled={filteredEntries.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 text-sm"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <LoadingSkeleton variant="table" rows={5} columns={7} />
          ) : filteredEntries.length === 0 ? (
            <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-200 text-center">
              <AlertTriangle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Unbilled Time</h3>
              <p className="text-sm text-gray-600">All time entries in this period have valid cost codes.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <ResponsiveTable>
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Employee</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Customer</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Service Item</th>
                      <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Hours</th>
                      <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
                      <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredEntries.map(entry => {
                      const hrs = entry.hours + entry.minutes / 60;
                      const hasName = !!entry.service_item_name;
                      return (
                        <tr key={entry.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{entry.txn_date}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{entry.employee_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{entry.customer_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{entry.service_item_name || '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">{hrs.toFixed(2)}</td>
                          <td className="px-4 py-3 text-center">
                            {hasName ? (
                              <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800">
                                Unmatched Item
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800">
                                No Cost Code
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Link
                              href="/time-entries-enhanced"
                              className="text-blue-600 hover:text-blue-800"
                              title="Go to Time Entries to fix"
                            >
                              <ExternalLink className="w-4 h-4 inline" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ResponsiveTable>
            </div>
          )}
    </AppShell>
  );
}
