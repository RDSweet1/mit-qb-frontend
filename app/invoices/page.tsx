'use client';

import { useState } from 'react';
import { ArrowLeft, DollarSign, Calendar, FileText, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { callEdgeFunction } from '@/lib/supabaseClient';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

export default function InvoicesPage() {
  const [creating, setCreating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const lastMonth = subMonths(new Date(), 1);
    return format(lastMonth, 'yyyy-MM');
  });

  const createMonthlyInvoices = async () => {
    try {
      setCreating(true);
      setError(null);
      setSuccess(false);
      setResult(null);

      const monthStart = new Date(selectedMonth + '-01');
      const monthEnd = endOfMonth(monthStart);

      const response = await callEdgeFunction('create-invoices', {
        month: format(monthStart, 'yyyy-MM'),
        monthStart: format(monthStart, 'yyyy-MM-dd'),
        monthEnd: format(monthEnd, 'yyyy-MM-dd'),
      });

      setResult(response);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoices');
    } finally {
      setCreating(false);
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
              <h1 className="text-2xl font-bold text-gray-900">Monthly Invoices</h1>
              <p className="text-sm text-gray-600">Create invoices in QuickBooks Online</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Create Monthly Invoices</h2>
              <p className="text-sm text-gray-600">Generate invoices for all customers with billable time</p>
            </div>
          </div>

          <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <h3 className="font-semibold text-purple-900 mb-2">Invoice Generation Process:</h3>
            <ul className="text-sm text-purple-800 space-y-1 list-disc list-inside">
              <li>Retrieves all billable time entries for the selected month</li>
              <li>Groups hours by customer and service item</li>
              <li>Creates invoices directly in QuickBooks Online</li>
              <li>Uses service item rates from QuickBooks for accurate billing</li>
              <li>Skips customers with zero billable hours</li>
            </ul>
          </div>

          <div className="mb-6">
            <label htmlFor="monthSelect" className="block text-sm font-medium text-gray-700 mb-2">
              Select Billing Month
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="month"
                id="monthSelect"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Period: {format(new Date(selectedMonth + '-01'), 'MMMM yyyy')}
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {success && result && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-green-800 font-medium mb-2">
                    Invoices created successfully!
                  </p>
                  <div className="text-sm text-green-700">
                    <p>• Created: {result.created || 0} invoices</p>
                    <p>• Skipped: {result.skipped || 0} customers (no billable hours)</p>
                    {result.errors && result.errors.length > 0 && (
                      <p className="text-red-600">• Errors: {result.errors.length}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={createMonthlyInvoices}
            disabled={creating}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? (
              <>
                <div className="spinner w-5 h-5 border-2"></div>
                Creating invoices...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                Create Monthly Invoices
              </>
            )}
          </button>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Important Notes:</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Invoices are created in QuickBooks Online immediately</li>
              <li>• You can review and edit invoices in QuickBooks before sending</li>
              <li>• Duplicate invoices are prevented by checking existing records</li>
              <li>• All invoice creation is logged for accounting records</li>
            </ul>
          </div>
        </div>

        {/* Invoice Preview */}
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Preview</h3>
          <p className="text-sm text-gray-500 text-center py-8">
            Preview will show estimated invoice details before creation...
          </p>
        </div>
      </main>
    </div>
  );
}
