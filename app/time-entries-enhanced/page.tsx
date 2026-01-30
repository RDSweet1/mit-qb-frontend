'use client';

import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, RefreshCw, Calendar, Clock, User, Building2, FileText, Download, Mail, LogOut } from 'lucide-react';
import Link from 'next/link';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { createClient } from '@supabase/supabase-js';
import { useMsal } from '@azure/msal-react';
import { ProtectedPage } from '@/components/ProtectedPage';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface TimeEntry {
  id: number;
  qb_time_id: string;
  employee_name: string;
  qb_customer_id: string;
  txn_date: string;
  start_time: string | null;
  end_time: string | null;
  hours: number;
  minutes: number;
  service_item_name: string;
  cost_code: string;
  description: string;
  notes: string | null;
  billable_status: string;
}

interface Customer {
  qb_customer_id: string;
  display_name: string;
}

type DatePreset = 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom';

export default function TimeEntriesEnhancedPage() {
  const { instance, accounts } = useMsal();
  const user = accounts[0];

  const handleLogout = () => {
    instance.logoutPopup();
  };

  // State
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [datePreset, setDatePreset] = useState<DatePreset>('this_week');
  const [startDate, setStartDate] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'datetime' | 'employee' | 'costcode'>('datetime');

  // Load customers
  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('qb_customer_id, display_name')
        .eq('is_active', true)
        .order('display_name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (err) {
      console.error('Error loading customers:', err);
    }
  };

  // Load time entries
  const loadTimeEntries = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('time_entries')
        .select('*')
        .gte('txn_date', startDate)
        .lte('txn_date', endDate);

      if (selectedCustomer !== 'all') {
        query = query.eq('qb_customer_id', selectedCustomer);
      }

      if (selectedEmployee !== 'all') {
        query = query.eq('employee_name', selectedEmployee);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEntries(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load time entries');
    } finally {
      setLoading(false);
    }
  };

  // Sync from QuickBooks
  const syncFromQuickBooks = async () => {
    try {
      setSyncing(true);
      setError(null);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/qb-time-sync`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ startDate, endDate })
        }
      );

      if (!response.ok) throw new Error('Sync failed');

      await loadTimeEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync with QuickBooks');
    } finally {
      setSyncing(false);
    }
  };

  // Handle date preset change
  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();

    switch (preset) {
      case 'this_week':
        setStartDate(format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
        setEndDate(format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
        break;
      case 'last_week':
        const lastWeek = subMonths(now, 0);
        const lastWeekStart = startOfWeek(new Date(lastWeek.getTime() - 7 * 24 * 60 * 60 * 1000), { weekStartsOn: 1 });
        setStartDate(format(lastWeekStart, 'yyyy-MM-dd'));
        setEndDate(format(endOfWeek(lastWeekStart, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
        break;
      case 'this_month':
        setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'));
        setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'));
        break;
      case 'last_month':
        const lastMonth = subMonths(now, 1);
        setStartDate(format(startOfMonth(lastMonth), 'yyyy-MM-dd'));
        setEndDate(format(endOfMonth(lastMonth), 'yyyy-MM-dd'));
        break;
    }
  };

  // Get unique employees from entries
  const uniqueEmployees = useMemo(() => {
    const employees = new Set(entries.map(e => e.employee_name));
    return Array.from(employees).sort();
  }, [entries]);

  // Sort and group entries
  const sortedEntries = useMemo(() => {
    const sorted = [...entries].sort((a, b) => {
      switch (sortBy) {
        case 'datetime':
          const dateCompare = a.txn_date.localeCompare(b.txn_date);
          if (dateCompare !== 0) return dateCompare;
          if (a.start_time && b.start_time) {
            return a.start_time.localeCompare(b.start_time);
          }
          return 0;
        case 'employee':
          return a.employee_name.localeCompare(b.employee_name);
        case 'costcode':
          return (a.cost_code || '').localeCompare(b.cost_code || '');
        default:
          return 0;
      }
    });
    return sorted;
  }, [entries, sortBy]);

  // Group by customer
  const groupedByCustomer = useMemo(() => {
    const groups = new Map<string, TimeEntry[]>();
    sortedEntries.forEach(entry => {
      const customerId = entry.qb_customer_id;
      if (!groups.has(customerId)) {
        groups.set(customerId, []);
      }
      groups.get(customerId)!.push(entry);
    });
    return groups;
  }, [sortedEntries]);

  // Calculate total hours for a group
  const calculateTotalHours = (entries: TimeEntry[]) => {
    const totalMinutes = entries.reduce((sum, entry) => {
      return sum + (entry.hours * 60) + entry.minutes;
    }, 0);
    return (totalMinutes / 60).toFixed(1);
  };

  // Format time range
  const formatTimeRange = (entry: TimeEntry) => {
    if (entry.start_time && entry.end_time) {
      const start = format(new Date(`2000-01-01T${entry.start_time}`), 'h:mm a');
      const end = format(new Date(`2000-01-01T${entry.end_time}`), 'h:mm a');
      return `${start} - ${end}`;
    }
    return 'Lump sum entry';
  };

  // Format duration
  const formatDuration = (hours: number, minutes: number) => {
    return `${hours}.${minutes.toString().padStart(2, '0')} hrs`;
  };

  // Initialize
  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    loadTimeEntries();
  }, [startDate, endDate, selectedCustomer, selectedEmployee]);

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
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Time Entries - Weekly Reports</h1>
                  <p className="text-sm text-gray-600">Production QuickBooks Data</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right hidden md:block">
                  <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                  <p className="text-xs text-gray-500">{user?.username}</p>
                </div>
                <button
                  onClick={syncFromQuickBooks}
                  disabled={syncing}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync from QB'}
                </button>
                <button
                  onClick={handleLogout}
                  className="px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Date Range Picker */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Range
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {(['this_week', 'last_week', 'this_month', 'last_month'] as DatePreset[]).map((preset) => (
                <button
                  key={preset}
                  onClick={() => handleDatePresetChange(preset)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    datePreset === preset
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {preset.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </button>
              ))}
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs text-gray-600 mb-1">From</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDatePreset('custom');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-600 mb-1">To</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDatePreset('custom');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Filters Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Customer Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer
              </label>
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Customers</option>
                {customers.map(customer => (
                  <option key={customer.qb_customer_id} value={customer.qb_customer_id}>
                    {customer.display_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Employee Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Employee
              </label>
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Employees</option>
                {uniqueEmployees.map(employee => (
                  <option key={employee} value={employee}>
                    {employee}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sort By
              </label>
              <div className="flex gap-2">
                {[
                  { value: 'datetime', label: 'Date/Time' },
                  { value: 'employee', label: 'Employee' },
                  { value: 'costcode', label: 'Cost Code' }
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => setSortBy(option.value as typeof sortBy)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      sortBy === option.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Time Entries Found</h3>
            <p className="text-gray-600 mb-6">
              No time entries found for the selected date range and filters.
            </p>
            <button
              onClick={syncFromQuickBooks}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <RefreshCw className="w-4 h-4" />
              Sync from QuickBooks
            </button>
          </div>
        ) : (
          <>
            {/* Summary Bar */}
            <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Entries: <span className="font-semibold text-gray-900">{entries.length}</span></p>
                  <p className="text-sm text-gray-600">Total Hours: <span className="font-semibold text-gray-900">{calculateTotalHours(entries)} hrs</span></p>
                </div>
                <div className="flex gap-2">
                  <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                    <FileText className="w-4 h-4" />
                    Generate Report
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    <Mail className="w-4 h-4" />
                    Email Report
                  </button>
                </div>
              </div>
            </div>

            {/* Grouped Entries */}
            {Array.from(groupedByCustomer.entries()).map(([customerId, customerEntries]) => {
              const customerName = customers.find(c => c.qb_customer_id === customerId)?.display_name || customerId;

              return (
                <div key={customerId} className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  {/* Customer Header */}
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Building2 className="w-6 h-6 text-white" />
                        <div>
                          <h2 className="text-xl font-bold text-white">{customerName}</h2>
                          <p className="text-blue-100 text-sm">
                            {customerEntries.length} entries • {calculateTotalHours(customerEntries)} hours
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Time Entries */}
                  <div className="divide-y divide-gray-200">
                    {customerEntries.map((entry, idx) => (
                      <div key={entry.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start gap-4">
                          {/* Date & Time */}
                          <div className="flex-shrink-0 w-48">
                            <div className="flex items-center gap-2 text-gray-900 font-medium">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              {format(new Date(entry.txn_date), 'EEE MMM dd, yyyy')}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                              <Clock className="w-4 h-4 text-gray-400" />
                              {formatTimeRange(entry)}
                            </div>
                            <div className="text-sm font-semibold text-blue-600 mt-1">
                              {formatDuration(entry.hours, entry.minutes)}
                            </div>
                          </div>

                          {/* Details */}
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-gray-400" />
                                <span className="font-medium text-gray-900">{entry.employee_name}</span>
                              </div>
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded">
                                {entry.service_item_name || entry.cost_code}
                              </span>
                              <span className={`px-2 py-1 text-xs font-semibold rounded ${
                                entry.billable_status === 'Billable'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {entry.billable_status}
                              </span>
                            </div>

                            {entry.description && (
                              <div className="text-sm text-gray-700 mb-1">
                                <span className="font-medium">Description:</span> {entry.description}
                              </div>
                            )}

                            {entry.notes && (
                              <div className="text-sm text-gray-600 italic">
                                <span className="font-medium">Notes:</span> {entry.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Customer Total */}
                  <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Total for {customerName}</span>
                      <span className="text-lg font-bold text-gray-900">{calculateTotalHours(customerEntries)} hours</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </main>
    </div>
    </ProtectedPage>
  );
}
