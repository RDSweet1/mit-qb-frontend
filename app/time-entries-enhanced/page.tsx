'use client';

import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, RefreshCw, Calendar, Clock, User, Building2, FileText, Download, Mail, LogOut, ArrowUp, ArrowDown } from 'lucide-react';
import Link from 'next/link';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns';
import { createClient } from '@supabase/supabase-js';
import { useMsal } from '@azure/msal-react';
import { ProtectedPage } from '@/components/ProtectedPage';
import { LockIcon } from '@/components/time-entries/LockIcon';
import { UnlockWarningDialog } from '@/components/time-entries/UnlockWarningDialog';
import { EditWarningBanner } from '@/components/time-entries/EditWarningBanner';

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
  approval_status: string;
  is_locked: boolean;
  unlocked_by: string | null;
  unlocked_at: string | null;
}

interface Customer {
  qb_customer_id: string;
  display_name: string;
}

type DatePreset = 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'all_time' | 'custom';

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

  // Filters - Default to last month for focused timesheet view
  const [datePreset, setDatePreset] = useState<DatePreset>('last_month');
  const [startDate, setStartDate] = useState(format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'));
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'datetime' | 'employee' | 'costcode'>('datetime');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc'); // desc = newest first

  // Lock/Unlock state
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null);
  const [isLockingAction, setIsLockingAction] = useState(false);

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

  // Generate CSV Report
  const generateReport = () => {
    try {
      // Prepare CSV data
      const headers = [
        'Date',
        'Employee',
        'Customer',
        'Cost Code',
        'Start Time',
        'End Time',
        'Hours',
        'Billable',
        'Status',
        'Notes'
      ];

      const rows = sortedEntries.map(entry => {
        const date = format(parseLocalDate(entry.txn_date), 'MM/dd/yyyy');
        const startTime = entry.start_time ? format(new Date(entry.start_time), 'h:mm a') : 'N/A';
        const endTime = entry.end_time ? format(new Date(entry.end_time), 'h:mm a') : 'N/A';
        const hours = `${entry.hours}.${entry.minutes.toString().padStart(2, '0')}`;

        return [
          date,
          entry.employee_name,
          entry.qb_customer_id,
          entry.cost_code,
          startTime,
          endTime,
          hours,
          entry.billable_status,
          entry.approval_status,
          (entry.notes || '').replace(/"/g, '""') // Escape quotes for CSV
        ];
      });

      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `time_entries_${startDate}_to_${endDate}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log('✅ Report generated successfully');
    } catch (err) {
      console.error('❌ Report generation failed:', err);
      setError('Failed to generate report: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  // Email Report - Generic function
  const sendEmailReport = async (recipient: string, recipientType: string) => {
    try {
      setError(null);

      // Prepare report data
      const reportData = {
        startDate,
        endDate,
        entries: sortedEntries.map(entry => ({
          date: entry.txn_date,
          employee: entry.employee_name,
          customer: entry.qb_customer_id,
          costCode: entry.cost_code,
          hours: `${entry.hours}.${entry.minutes.toString().padStart(2, '0')}`,
          billable: entry.billable_status,
          notes: entry.notes
        })),
        summary: {
          totalEntries: entries.length,
          totalHours: calculateTotalHours(entries)
        }
      };

      // Call email edge function
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/email_time_report`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            report: reportData,
            recipient: recipient
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Email failed: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        setError(`✅ Report emailed successfully to ${recipientType}!`);
      } else {
        throw new Error(result.error || 'Email sending failed');
      }

    } catch (err) {
      console.error('❌ Email report failed:', err);
      setError('Failed to email report: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  // Email to David (for testing)
  const emailToMe = () => sendEmailReport('david@mitigationconsulting.com', 'David');

  // Email to Bookkeeper (Sharon Kisner)
  const emailToBookkeeper = () => sendEmailReport('sharon@mitigationconsulting.com', 'Bookkeeper');

  // Email to Insured (Customer)
  const emailToInsured = async () => {
    // Get selected customer's email
    if (selectedCustomer === 'all') {
      setError('⚠️ Please select a specific customer to email the report to them.');
      return;
    }

    const customer = customers.find(c => c.qb_customer_id === selectedCustomer);
    if (!customer) {
      setError('❌ Customer not found');
      return;
    }

    if (!customer.email) {
      setError('❌ Customer email not found. Please add customer email in QuickBooks.');
      return;
    }

    sendEmailReport(customer.email, `Customer (${customer.display_name})`);
  };

  // Sync from QuickBooks
  const syncFromQuickBooks = async () => {
    try {
      console.log('🔄 QB Sync: Starting sync...');
      console.log('📅 Date Range:', { startDate, endDate });

      setSyncing(true);
      setError(null);

      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/qb-time-sync`;
      console.log('🌐 QB Sync: Calling Edge Function:', url);

      const requestBody = { startDate, endDate, billableOnly: false };
      console.log('📦 Request Body:', requestBody);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      console.log('📡 QB Sync: Response Status:', response.status);

      // Parse response body
      const responseData = await response.json();
      console.log('📄 QB Sync: Response Data:', responseData);

      if (!response.ok) {
        const errorMessage = responseData.error || 'Sync failed';
        console.error('❌ QB Sync: Error:', errorMessage);

        // Show detailed error in UI
        if (responseData.error && responseData.error.includes('invalid_client')) {
          setError('QuickBooks authentication failed. Client credentials may be incorrect. Check Edge Function logs in Supabase.');
        } else if (responseData.error && responseData.error.includes('Token refresh failed')) {
          setError(`Token refresh failed: ${responseData.error}`);
        } else {
          setError(`Sync failed: ${errorMessage}`);
        }
        return;
      }

      console.log('✅ QB Sync: Success!', {
        synced: responseData.synced,
        total: responseData.total,
        customers: responseData.customers
      });

      // Show success message
      setError(`✅ Success! Synced ${responseData.synced} time entries from ${responseData.customers} customers.`);

      await loadTimeEntries();
    } catch (err) {
      console.error('❌ QB Sync: Fatal error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync with QuickBooks';
      setError(`Fatal error: ${errorMessage}`);
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
      case 'all_time':
        // Show all data - set a very wide date range
        setStartDate('2020-01-01');
        setEndDate(format(new Date(), 'yyyy-MM-dd'));
        break;
    }
  };

  // Handle lock/unlock toggle
  const handleLockToggle = (entry: TimeEntry) => {
    setSelectedEntry(entry);
    setIsLockingAction(entry.is_locked === false); // If currently unlocked, we're locking
    setUnlockDialogOpen(true);
  };

  // Confirm unlock/lock action
  const confirmLockToggle = async () => {
    if (!selectedEntry || !user) return;

    try {
      const functionName = isLockingAction ? 'lock_time_entry' : 'unlock_time_entry';

      const { data, error } = await supabase.rpc(functionName, {
        entry_id: selectedEntry.id,
        user_email: user.username
      });

      if (error) throw error;

      // Update local state
      setEntries(entries.map(e =>
        e.id === selectedEntry.id
          ? {
              ...e,
              is_locked: isLockingAction,
              unlocked_by: isLockingAction ? null : user.username,
              unlocked_at: isLockingAction ? null : new Date().toISOString()
            }
          : e
      ));

      setUnlockDialogOpen(false);
      setSelectedEntry(null);
    } catch (err: any) {
      alert('Error: ' + err.message);
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
      let comparison = 0;

      switch (sortBy) {
        case 'datetime':
          const dateCompare = a.txn_date.localeCompare(b.txn_date);
          if (dateCompare !== 0) {
            comparison = dateCompare;
          } else if (a.start_time && b.start_time) {
            comparison = a.start_time.localeCompare(b.start_time);
          }
          break;
        case 'employee':
          comparison = a.employee_name.localeCompare(b.employee_name);
          break;
        case 'costcode':
          comparison = (a.cost_code || '').localeCompare(b.cost_code || '');
          break;
      }

      // Apply sort direction
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [entries, sortBy, sortDirection]);

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

  // Parse date string in local timezone (avoids UTC conversion issues)
  const parseLocalDate = (dateString: string) => {
    // Parse YYYY-MM-DD as local date, not UTC
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // Format time range
  const formatTimeRange = (entry: TimeEntry) => {
    if (entry.start_time && entry.end_time) {
      // Handle both full timestamps and time-only strings
      const startDate = entry.start_time?.includes('T')
        ? new Date(entry.start_time)
        : new Date(`2000-01-01T${entry.start_time}`);
      const endDate = entry.end_time?.includes('T')
        ? new Date(entry.end_time)
        : new Date(`2000-01-01T${entry.end_time}`);

      const start = format(startDate, 'h:mm a');
      const end = format(endDate, 'h:mm a');
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
              <button
                onClick={() => handleDatePresetChange('all_time')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  datePreset === 'all_time'
                    ? 'bg-green-600 text-white'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                📊 Show All Data
              </button>
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
                {/* Sort Direction Toggle */}
                <button
                  onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors flex items-center gap-1"
                  title={sortDirection === 'asc' ? 'Oldest to Newest' : 'Newest to Oldest'}
                >
                  {sortDirection === 'asc' ? (
                    <>
                      <ArrowUp className="w-4 h-4" />
                      <span className="hidden sm:inline">Old→New</span>
                    </>
                  ) : (
                    <>
                      <ArrowDown className="w-4 h-4" />
                      <span className="hidden sm:inline">New→Old</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border-2 border-red-300 rounded-lg p-6 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="text-red-600 mt-1">⚠️</div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-red-900 mb-2">Sync Error</h3>
                <p className="text-red-800 whitespace-pre-wrap font-mono text-sm">{error}</p>
                <p className="text-red-600 text-xs mt-3">
                  Check browser console (F12) for detailed debug logs.
                </p>
              </div>
            </div>
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
            {/* Unlocked Entries Warning */}
            {entries.some(e => !e.is_locked) && (
              <div className="mb-4 bg-orange-50 border-l-4 border-orange-500 p-3 rounded-r-md">
                <p className="text-sm text-orange-800">
                  <strong>{entries.filter(e => !e.is_locked).length} entries</strong> are unlocked and editable.
                  Changes will not sync to QuickBooks.
                </p>
              </div>
            )}

            {/* Summary Bar */}
            <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Entries: <span className="font-semibold text-gray-900">{entries.length}</span></p>
                  <p className="text-sm text-gray-600">Total Hours: <span className="font-semibold text-gray-900">{calculateTotalHours(entries)} hrs</span></p>
                </div>
                <div className="flex flex-col gap-3">
                  {/* Generate Report Button */}
                  <button
                    onClick={generateReport}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={entries.length === 0}
                    title={entries.length === 0 ? 'No entries to report' : 'Download CSV report'}
                  >
                    <FileText className="w-4 h-4" />
                    Generate Report
                  </button>

                  {/* Email Buttons Row */}
                  <div className="flex gap-2">
                    {/* Email to Me */}
                    <div className="flex flex-col">
                      <button
                        onClick={emailToMe}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-t-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={entries.length === 0}
                        title="Email report to David for testing"
                      >
                        <Mail className="w-4 h-4" />
                        Email to Me
                      </button>
                      <span className="px-2 py-1 bg-blue-50 text-xs text-blue-700 border border-blue-200 rounded-b-lg text-center">
                        david@mitigationconsulting.com
                      </span>
                    </div>

                    {/* Email to Bookkeeper */}
                    <div className="flex flex-col">
                      <button
                        onClick={emailToBookkeeper}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-t-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={entries.length === 0}
                        title="Email report to Sharon Kisner (Bookkeeper)"
                      >
                        <Mail className="w-4 h-4" />
                        Email to Bookkeeper
                      </button>
                      <span className="px-2 py-1 bg-purple-50 text-xs text-purple-700 border border-purple-200 rounded-b-lg text-center">
                        sharon@mitigationconsulting.com
                      </span>
                    </div>

                    {/* Email to Insured (Customer) */}
                    <div className="flex flex-col">
                      <button
                        onClick={emailToInsured}
                        disabled={entries.length === 0 || selectedCustomer === 'all'}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-t-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400"
                        title={
                          entries.length === 0
                            ? 'No entries to email'
                            : selectedCustomer === 'all'
                            ? 'Select a specific customer first'
                            : 'Email report to customer'
                        }
                      >
                        <Mail className="w-4 h-4" />
                        Email to Insured
                      </button>
                      <span className="px-2 py-1 bg-orange-50 text-xs text-orange-700 border border-orange-200 rounded-b-lg text-center">
                        {selectedCustomer === 'all'
                          ? 'Select customer first'
                          : customers.find(c => c.qb_customer_id === selectedCustomer)?.email || 'No email set'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Conditional Display: Grouped by Customer or Flat List */}
            {selectedCustomer === 'all' ? (
              /* Grouped View - Show all customers with headers */
              Array.from(groupedByCustomer.entries()).map(([customerId, customerEntries]) => {
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
                              {format(parseLocalDate(entry.txn_date), 'EEE MMM dd, yyyy')}
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
                              <LockIcon
                                isLocked={entry.is_locked}
                                unlockedBy={entry.unlocked_by}
                                unlockedAt={entry.unlocked_at}
                                onToggle={() => handleLockToggle(entry)}
                              />
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
              })
            ) : (
              /* Flat List View - Single customer selected, show entries by date */
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="divide-y divide-gray-200">
                  {sortedEntries.map((entry) => (
                    <div key={entry.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start gap-4">
                        {/* Date & Time */}
                        <div className="flex-shrink-0 w-48">
                          <div className="flex items-center gap-2 text-gray-900 font-medium">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            {format(parseLocalDate(entry.txn_date), 'EEE MMM dd, yyyy')}
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
                            <LockIcon
                              isLocked={entry.is_locked}
                              unlockedBy={entry.unlocked_by}
                              unlockedAt={entry.unlocked_at}
                              onToggle={() => handleLockToggle(entry)}
                            />
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
              </div>
            )}
          </>
        )}
      </main>
    </div>

    <UnlockWarningDialog
      isOpen={unlockDialogOpen}
      isLocking={isLockingAction}
      entryDetails={selectedEntry}
      onConfirm={confirmLockToggle}
      onCancel={() => {
        setUnlockDialogOpen(false);
        setSelectedEntry(null);
      }}
    />
    </ProtectedPage>
  );
}
