'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Send, Calendar, FileText, Mail, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { supabase, callEdgeFunction } from '@/lib/supabaseClient';
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';

export default function ReportsPage() {
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedWeek, setSelectedWeek] = useState(() => {
    const lastWeek = subWeeks(new Date(), 1);
    return format(startOfWeek(lastWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  });

  // Report status tracking
  interface ReportPeriod {
    id: number;
    customer_name: string;
    qb_customer_id: string;
    week_start: string;
    week_end: string;
    status: 'pending' | 'sent' | 'supplemental_sent' | 'no_time';
    total_hours: number;
    entry_count: number;
    late_entry_count: number;
    late_entry_hours: number;
    sent_at: string | null;
  }

  const [reportPeriods, setReportPeriods] = useState<ReportPeriod[]>([]);
  const [statusLoading, setStatusLoading] = useState(true);

  useEffect(() => {
    async function loadReportPeriods() {
      setStatusLoading(true);
      const eightWeeksAgo = format(subWeeks(new Date(), 8), 'yyyy-MM-dd');
      const { data, error: fetchError } = await supabase
        .from('report_periods')
        .select('*')
        .gte('week_start', eightWeeksAgo)
        .order('week_start', { ascending: false })
        .order('customer_name', { ascending: true });
      if (!fetchError && data) {
        setReportPeriods(data);
      }
      setStatusLoading(false);
    }
    loadReportPeriods();
  }, [success]); // re-fetch after sending

  // Group report periods by week
  const periodsByWeek = reportPeriods.reduce<Record<string, ReportPeriod[]>>((acc, rp) => {
    if (!acc[rp.week_start]) acc[rp.week_start] = [];
    acc[rp.week_start].push(rp);
    return acc;
  }, {});

  const sendWeeklyReports = async () => {
    try {
      setSending(true);
      setError(null);
      setSuccess(false);

      const weekStart = new Date(selectedWeek);
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

      await callEdgeFunction('send-reminder', {
        weekStart: format(weekStart, 'yyyy-MM-dd'),
        weekEnd: format(weekEnd, 'yyyy-MM-dd'),
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reports');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Weekly Reports</h1>
              <p className="text-sm text-gray-600">Generate and send time reports to clients</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Send Weekly Time Reports</h2>
              <p className="text-sm text-gray-600">Email time summaries to all active clients</p>
            </div>
          </div>

          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">What gets sent:</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Total hours worked for each customer during the selected week</li>
              <li>Breakdown by employee and service type</li>
              <li>Date range and billing period information</li>
              <li>Sent via Microsoft Graph API using your Outlook account</li>
            </ul>
          </div>

          <div className="mb-6">
            <label htmlFor="weekSelect" className="block text-sm font-medium text-gray-700 mb-2">
              Select Week to Report
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                id="weekSelect"
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Week: {format(new Date(selectedWeek), 'MMM dd')} - {format(endOfWeek(new Date(selectedWeek), { weekStartsOn: 1 }), 'MMM dd, yyyy')}
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-green-600" />
                <p className="text-green-800 font-medium">
                  Weekly reports sent successfully!
                </p>
              </div>
            </div>
          )}

          <button
            onClick={sendWeeklyReports}
            disabled={sending}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-semibold hover:from-green-600 hover:to-green-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <>
                <div className="spinner w-5 h-5 border-2"></div>
                Sending reports...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Send Weekly Reports
              </>
            )}
          </button>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Report Details:</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Emails are sent to customer email addresses in QuickBooks</li>
              <li>• Reports include only billable time entries</li>
              <li>• Customers with zero hours are skipped</li>
              <li>• Email logs are stored for 1 year</li>
            </ul>
          </div>
        </div>

        {/* Report Status by Week */}
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Report Status (Last 8 Weeks)</h3>

          {statusLoading ? (
            <div className="text-center py-8">
              <div className="spinner w-6 h-6 border-2 mx-auto mb-2"></div>
              <p className="text-sm text-gray-500">Loading report status...</p>
            </div>
          ) : Object.keys(periodsByWeek).length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              No report periods tracked yet. Reports will appear here after the next weekly send.
            </p>
          ) : (
            <div className="space-y-6">
              {Object.entries(periodsByWeek).map(([weekStart, periods]) => {
                const weekEndDate = periods[0]?.week_end || '';
                const sentCount = periods.filter(p => p.status === 'sent' || p.status === 'supplemental_sent').length;
                const missedCount = periods.filter(p => p.status === 'pending').length;
                const noTimeCount = periods.filter(p => p.status === 'no_time').length;
                const lateCount = periods.filter(p => p.late_entry_count > 0).length;

                return (
                  <div key={weekStart} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Week header */}
                    <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span className="font-medium text-gray-900">
                          {format(new Date(weekStart + 'T12:00:00'), 'MMM dd')} - {format(new Date(weekEndDate + 'T12:00:00'), 'MMM dd, yyyy')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        {sentCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full">
                            <CheckCircle className="w-3 h-3" /> {sentCount} sent
                          </span>
                        )}
                        {missedCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full">
                            <XCircle className="w-3 h-3" /> {missedCount} missed
                          </span>
                        )}
                        {noTimeCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                            <Clock className="w-3 h-3" /> {noTimeCount} no time
                          </span>
                        )}
                        {lateCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full">
                            <AlertTriangle className="w-3 h-3" /> {lateCount} late entries
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Customer rows */}
                    <table className="w-full">
                      <thead>
                        <tr className="text-xs text-gray-500 border-b border-gray-100">
                          <th className="text-left px-4 py-2 font-medium">Customer</th>
                          <th className="text-center px-4 py-2 font-medium">Status</th>
                          <th className="text-right px-4 py-2 font-medium">Hours</th>
                          <th className="text-right px-4 py-2 font-medium">Entries</th>
                          <th className="text-right px-4 py-2 font-medium">Late</th>
                        </tr>
                      </thead>
                      <tbody>
                        {periods.map((period) => (
                          <tr key={period.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm text-gray-900">{period.customer_name || 'Unknown'}</td>
                            <td className="px-4 py-2 text-center">
                              {period.status === 'sent' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                  <CheckCircle className="w-3 h-3" /> Sent
                                </span>
                              )}
                              {period.status === 'supplemental_sent' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                  <Mail className="w-3 h-3" /> Supplemental
                                </span>
                              )}
                              {period.status === 'pending' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                                  <XCircle className="w-3 h-3" /> Missed
                                </span>
                              )}
                              {period.status === 'no_time' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">
                                  <Clock className="w-3 h-3" /> No Time
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-sm text-right text-gray-700">
                              {period.total_hours > 0 ? Number(period.total_hours).toFixed(2) : '-'}
                            </td>
                            <td className="px-4 py-2 text-sm text-right text-gray-700">
                              {period.entry_count || '-'}
                            </td>
                            <td className="px-4 py-2 text-sm text-right">
                              {period.late_entry_count > 0 ? (
                                <span className="inline-flex items-center gap-1 text-orange-600 font-medium">
                                  <AlertTriangle className="w-3 h-3" />
                                  {period.late_entry_count} ({Number(period.late_entry_hours).toFixed(1)}h)
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
