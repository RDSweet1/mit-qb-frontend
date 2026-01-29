'use client';

import { useState } from 'react';
import { ArrowLeft, Send, Calendar, FileText, Mail } from 'lucide-react';
import Link from 'next/link';
import { callEdgeFunction } from '@/lib/supabaseClient';
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';

export default function ReportsPage() {
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedWeek, setSelectedWeek] = useState(() => {
    const lastWeek = subWeeks(new Date(), 1);
    return format(startOfWeek(lastWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  });

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

        {/* Recent Activity */}
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Report Activity</h3>
          <p className="text-sm text-gray-500 text-center py-8">
            Activity log coming soon...
          </p>
        </div>
      </main>
    </div>
  );
}
