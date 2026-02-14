'use client';

import { useState, useEffect } from 'react';
import { Send, Calendar, FileText, Mail, CheckCircle, XCircle, Clock, AlertTriangle, RefreshCw, MessageSquare } from 'lucide-react';
import { supabase, callEdgeFunction } from '@/lib/supabaseClient';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import type { ReportPeriod } from '@/lib/types';

export default function ReportsPage() {
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedWeek, setSelectedWeek] = useState(() => {
    const lastWeek = subWeeks(new Date(), 1);
    return format(startOfWeek(lastWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  });

  const [reportPeriods, setReportPeriods] = useState<ReportPeriod[]>([]);
  const [statusLoading, setStatusLoading] = useState(true);
  const [clarificationCounts, setClarificationCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    // Load active clarification counts grouped by customer
    async function loadClarificationCounts() {
      const { data } = await supabase
        .from('internal_assignments')
        .select('time_entry_id')
        .in('status', ['pending', 'responded']);

      if (data?.length) {
        const entryIds = data.map(a => a.time_entry_id);
        const { data: entries } = await supabase
          .from('time_entries')
          .select('qb_customer_id')
          .in('id', entryIds);

        const counts: Record<string, number> = {};
        (entries || []).forEach(e => {
          counts[e.qb_customer_id] = (counts[e.qb_customer_id] || 0) + 1;
        });
        setClarificationCounts(counts);
      }
    }
    loadClarificationCounts();
  }, [success]);

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

  // Supplemental report state
  const [sendingSupplemental, setSendingSupplemental] = useState<number | null>(null); // period id being sent
  const [supplementalResult, setSupplementalResult] = useState<{ id: number; success: boolean; message: string } | null>(null);

  const sendSupplementalReport = async (period: ReportPeriod) => {
    if (!confirm(`Send supplemental report to ${period.customer_name} for week of ${period.week_start}?\n\nMake sure notes have been reviewed and updated before sending.`)) {
      return;
    }
    try {
      setSendingSupplemental(period.id);
      setSupplementalResult(null);
      const result = await callEdgeFunction('send-supplemental-report', {
        qb_customer_id: period.qb_customer_id,
        week_start: period.week_start,
        week_end: period.week_end
      });
      setSupplementalResult({
        id: period.id,
        success: true,
        message: `Supplemental sent to ${period.customer_name} (${result.newEntries} new entries, ${result.noteChanges} note changes)`
      });
      // Refresh data
      setSuccess(prev => !prev);
    } catch (err) {
      setSupplementalResult({
        id: period.id,
        success: false,
        message: err instanceof Error ? err.message : 'Failed to send supplemental report'
      });
    } finally {
      setSendingSupplemental(null);
    }
  };

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
    <AppShell>
      <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Weekly Reports"
        subtitle="Generate and send time reports to clients"
        icon={<FileText className="w-6 h-6 text-green-600" />}
      />
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
                const acceptedCount = periods.filter(p => p.status === 'accepted').length;
                const disputedCount = periods.filter(p => p.status === 'disputed').length;
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
                        {acceptedCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                            <CheckCircle className="w-3 h-3" /> {acceptedCount} accepted
                          </span>
                        )}
                        {sentCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full">
                            <CheckCircle className="w-3 h-3" /> {sentCount} sent
                          </span>
                        )}
                        {disputedCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full">
                            <AlertTriangle className="w-3 h-3" /> {disputedCount} disputed
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
                          <th className="text-right px-4 py-2 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {periods.map((period) => (
                          <tr key={period.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {period.customer_name || 'Unknown'}
                              {clarificationCounts[period.qb_customer_id] > 0 && (
                                <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium" title={`${clarificationCounts[period.qb_customer_id]} entries pending clarification`}>
                                  <MessageSquare className="w-3 h-3" />
                                  {clarificationCounts[period.qb_customer_id]}
                                </span>
                              )}
                            </td>
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
                              {period.status === 'accepted' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                                  <CheckCircle className="w-3 h-3" /> Accepted
                                </span>
                              )}
                              {period.status === 'disputed' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                                  <AlertTriangle className="w-3 h-3" /> Disputed
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
                            <td className="px-4 py-2 text-right">
                              {(period.status === 'sent' && period.late_entry_count > 0) ? (
                                <button
                                  onClick={() => sendSupplementalReport(period)}
                                  disabled={sendingSupplemental === period.id}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-orange-500 text-white rounded text-xs font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                  {sendingSupplemental === period.id ? (
                                    <><div className="spinner w-3 h-3 border"></div> Sending...</>
                                  ) : (
                                    <><RefreshCw className="w-3 h-3" /> Send Update</>
                                  )}
                                </button>
                              ) : period.status === 'supplemental_sent' ? (
                                <span className="text-xs text-blue-600">Update sent</span>
                              ) : null}
                              {supplementalResult?.id === period.id && (
                                <div className={`mt-1 text-xs ${supplementalResult.success ? 'text-green-600' : 'text-red-600'}`}>
                                  {supplementalResult.message}
                                </div>
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
      </div>
    </AppShell>
  );
}
