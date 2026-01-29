'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Send, Calendar, FileText, Eye, Check, X, Building2, Clock, User, Filter } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';

interface TimeEntry {
  id: string;
  employee_name: string;
  customer_name: string;
  service_item: string;
  hours: number;
  entry_date: string;
  billable_status: string;
}

interface CustomerReport {
  customer_name: string;
  total_hours: number;
  entries: TimeEntry[];
  email: string;
}

export default function ReportsEnhancedPage() {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [customerReports, setCustomerReports] = useState<CustomerReport[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [previewMode, setPreviewMode] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);

  // Date range selection
  const [startDate, setStartDate] = useState(() => {
    const lastWeek = subWeeks(new Date(), 1);
    return format(startOfWeek(lastWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  });
  const [endDate, setEndDate] = useState(() => {
    const lastWeek = subWeeks(new Date(), 1);
    return format(endOfWeek(lastWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  });

  // Filters
  const [filterCustomer, setFilterCustomer] = useState<string>('');
  const [filterEmployee, setFilterEmployee] = useState<string>('');

  // Load time entries
  const loadTimeEntries = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .gte('entry_date', startDate)
        .lte('entry_date', endDate)
        .eq('billable_status', 'Billable')
        .order('customer_name')
        .order('entry_date');

      if (error) throw error;

      const entries = data || [];
      setTimeEntries(entries);

      // Group by customer
      const grouped = entries.reduce((acc: Record<string, CustomerReport>, entry) => {
        if (!acc[entry.customer_name]) {
          acc[entry.customer_name] = {
            customer_name: entry.customer_name,
            total_hours: 0,
            entries: [],
            email: '', // Will be populated from customers table
          };
        }
        acc[entry.customer_name].total_hours += entry.hours;
        acc[entry.customer_name].entries.push(entry);
        return acc;
      }, {});

      const reports = Object.values(grouped);
      setCustomerReports(reports);

      // Select all by default
      setSelectedCustomers(new Set(reports.map(r => r.customer_name)));

    } catch (err) {
      console.error('Error loading time entries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTimeEntries();
  }, [startDate, endDate]);

  // Toggle customer selection
  const toggleCustomer = (customerName: string) => {
    const newSelected = new Set(selectedCustomers);
    if (newSelected.has(customerName)) {
      newSelected.delete(customerName);
    } else {
      newSelected.add(customerName);
    }
    setSelectedCustomers(newSelected);
  };

  // Select/Deselect all
  const selectAll = () => {
    setSelectedCustomers(new Set(customerReports.map(r => r.customer_name)));
  };

  const deselectAll = () => {
    setSelectedCustomers(new Set());
  };

  // Send reports
  const sendReports = async (skipReview: boolean = false) => {
    if (!skipReview && !previewMode) {
      setPreviewMode(true);
      return;
    }

    try {
      setSending(true);
      const customersToSend = customerReports.filter(r => selectedCustomers.has(r.customer_name));

      // Call Edge Function to send emails
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-reminder`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            weekStart: startDate,
            weekEnd: endDate,
            customers: customersToSend.map(r => r.customer_name),
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to send reports');

      alert(`✅ Successfully sent ${customersToSend.length} reports!`);
      setPreviewMode(false);
    } catch (err) {
      console.error('Error sending reports:', err);
      alert('❌ Error sending reports. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // Filter reports
  const filteredReports = customerReports.filter(report => {
    if (filterCustomer && !report.customer_name.toLowerCase().includes(filterCustomer.toLowerCase())) {
      return false;
    }
    if (filterEmployee) {
      const hasEmployee = report.entries.some(e =>
        e.employee_name.toLowerCase().includes(filterEmployee.toLowerCase())
      );
      if (!hasEmployee) return false;
    }
    return true;
  });

  const selectedCount = selectedCustomers.size;
  const totalHours = customerReports
    .filter(r => selectedCustomers.has(r.customer_name))
    .reduce((sum, r) => sum + r.total_hours, 0);

  return (
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
                <h1 className="text-2xl font-bold text-gray-900">Weekly Time Reports</h1>
                <p className="text-sm text-gray-600">Search, filter, preview, and send reports to customers</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!previewMode && (
                <button
                  onClick={() => sendReports(true)}
                  disabled={sending || selectedCount === 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send Without Review
                </button>
              )}
              <button
                onClick={() => sendReports(false)}
                disabled={sending || selectedCount === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {previewMode ? (
                  <>
                    <Send className="w-4 h-4" />
                    {sending ? 'Sending...' : `Send ${selectedCount} Reports`}
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    Review & Send
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!previewMode ? (
          <>
            {/* Search & Filter Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Search & Filter
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Date Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Filters */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Filter by Customer
                  </label>
                  <input
                    type="text"
                    placeholder="Search customer..."
                    value={filterCustomer}
                    onChange={(e) => setFilterCustomer(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Filter by Employee
                  </label>
                  <input
                    type="text"
                    placeholder="Search employee..."
                    value={filterEmployee}
                    onChange={(e) => setFilterEmployee(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Period: {format(new Date(startDate), 'MMM dd, yyyy')} - {format(new Date(endDate), 'MMM dd, yyyy')}
                </div>
                <button
                  onClick={loadTimeEntries}
                  disabled={loading}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {loading ? 'Loading...' : 'Refresh'}
                </button>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <p className="text-sm text-gray-600 mb-1">Total Customers</p>
                <p className="text-2xl font-bold text-gray-900">{filteredReports.length}</p>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <p className="text-sm text-gray-600 mb-1">Selected to Send</p>
                <p className="text-2xl font-bold text-blue-600">{selectedCount}</p>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <p className="text-sm text-gray-600 mb-1">Total Hours (Selected)</p>
                <p className="text-2xl font-bold text-green-600">{totalHours.toFixed(2)}</p>
              </div>
            </div>

            {/* Selection Controls */}
            <div className="mb-4 flex items-center gap-3">
              <button
                onClick={selectAll}
                className="px-4 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
              >
                Select All ({filteredReports.length})
              </button>
              <button
                onClick={deselectAll}
                className="px-4 py-2 text-sm bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Deselect All
              </button>
            </div>

            {/* Customer Reports List */}
            <div className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="spinner"></div>
                </div>
              ) : filteredReports.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Time Entries Found</h3>
                  <p className="text-gray-600">
                    No billable hours found for the selected date range. Try adjusting your search criteria.
                  </p>
                </div>
              ) : (
                filteredReports.map((report) => (
                  <div
                    key={report.customer_name}
                    className={`bg-white rounded-xl shadow-sm border-2 transition-all ${
                      selectedCustomers.has(report.customer_name)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-4">
                          <input
                            type="checkbox"
                            checked={selectedCustomers.has(report.customer_name)}
                            onChange={() => toggleCustomer(report.customer_name)}
                            className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Building2 className="w-5 h-5 text-gray-400" />
                              <h3 className="text-lg font-semibold text-gray-900">
                                {report.customer_name}
                              </h3>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {report.total_hours.toFixed(2)} hours
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="w-4 h-4" />
                                {new Set(report.entries.map(e => e.employee_name)).size} employees
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedPreview(
                            selectedPreview === report.customer_name ? null : report.customer_name
                          )}
                          className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          {selectedPreview === report.customer_name ? 'Hide' : 'Show'} Details
                        </button>
                      </div>

                      {/* Expanded Details */}
                      {selectedPreview === report.customer_name && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <table className="min-w-full">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Hours</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {report.entries.map((entry, idx) => (
                                <tr key={idx} className="text-sm">
                                  <td className="px-4 py-2 text-gray-900">
                                    {format(new Date(entry.entry_date), 'MMM dd')}
                                  </td>
                                  <td className="px-4 py-2 text-gray-900">{entry.employee_name}</td>
                                  <td className="px-4 py-2 text-gray-600">{entry.service_item}</td>
                                  <td className="px-4 py-2 text-right font-medium text-gray-900">
                                    {entry.hours.toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                              <tr className="bg-gray-50 font-semibold">
                                <td colSpan={3} className="px-4 py-2 text-right text-gray-900">Total:</td>
                                <td className="px-4 py-2 text-right text-gray-900">
                                  {report.total_hours.toFixed(2)} hrs
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          /* Preview Mode */
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Review Reports Before Sending</h2>
              <p className="text-gray-600">
                You are about to send {selectedCount} report{selectedCount !== 1 ? 's' : ''} to the following customers:
              </p>
            </div>

            <div className="space-y-3 mb-8">
              {customerReports
                .filter(r => selectedCustomers.has(r.customer_name))
                .map(report => (
                  <div key={report.customer_name} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-medium text-gray-900">{report.customer_name}</p>
                        <p className="text-sm text-gray-600">{report.total_hours.toFixed(2)} hours</p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {report.entries.length} entries
                    </div>
                  </div>
                ))}
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => sendReports(false)}
                disabled={sending}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {sending ? (
                  <>
                    <div className="spinner w-5 h-5 border-2"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Confirm & Send {selectedCount} Reports
                  </>
                )}
              </button>
              <button
                onClick={() => setPreviewMode(false)}
                disabled={sending}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
