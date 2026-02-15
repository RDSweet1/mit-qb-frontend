'use client';

import { useState, useMemo } from 'react';
import {
  ArrowLeft,
  DollarSign,
  Calendar,
  FileText,
  CheckCircle,
  XCircle,
  SkipForward,
  Search,
  Loader2,
  AlertTriangle,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { useMsal } from '@azure/msal-react';
import { supabase, callEdgeFunction } from '@/lib/supabaseClient';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { format, subMonths, endOfMonth } from 'date-fns';
import InvoicePreviewCard, { type CustomerPreview } from '@/components/invoices/InvoicePreviewCard';

type Stage = 'config' | 'loading' | 'preview' | 'executing' | 'results';

interface ExecutionResult {
  stagingId: number;
  customerName: string;
  action: string;
  status: string;
  invoiceId?: string;
  invoiceNumber?: string;
  total?: number;
  error?: string;
}

export default function InvoicesPage() {
  const { accounts } = useMsal();

  // Stage management
  const [stage, setStage] = useState<Stage>('config');

  // Config stage
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const lastMonth = subMonths(new Date(), 1);
    return format(lastMonth, 'yyyy-MM');
  });

  // Parse "yyyy-MM" into a local-time Date (avoids UTC timezone shift)
  const parseMonth = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m - 1, 1);
  };

  // Preview stage
  const [batchId, setBatchId] = useState<string | null>(null);
  const [previews, setPreviews] = useState<CustomerPreview[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Execute stage
  const [executingIndex, setExecutingIndex] = useState(0);
  const [executionResults, setExecutionResults] = useState<ExecutionResult[]>([]);
  const [executionSummary, setExecutionSummary] = useState<any>(null);
  const [executeError, setExecuteError] = useState<string | null>(null);

  // Profitability context for preview cards
  const [margins, setMargins] = useState<Record<string, number>>({});
  const [disputedCustomers, setDisputedCustomers] = useState<Set<string>>(new Set());

  // Update action for a customer
  const handleActionChange = (stagingId: number, action: string) => {
    setPreviews(prev =>
      prev.map(p => p.stagingId === stagingId ? { ...p, action } : p)
    );
  };

  // Action counts for the sticky bar
  const actionCounts = useMemo(() => {
    const counts = { create_new: 0, update_existing: 0, skip: 0, pending: 0 };
    for (const p of previews) {
      if (p.action in counts) counts[p.action as keyof typeof counts]++;
    }
    return counts;
  }, [previews]);

  const canExecute = actionCounts.pending === 0 && (actionCounts.create_new > 0 || actionCounts.update_existing > 0);

  // Set all actionable items to a specific action
  const setAllActions = (action: string) => {
    setPreviews(prev =>
      prev.map(p => {
        // Don't change already_logged or exists_match to create_new by default
        if (action === 'create_new' && (p.comparisonStatus === 'already_logged' || p.comparisonStatus === 'exists_match')) {
          return p;
        }
        return { ...p, action };
      })
    );
  };

  // Generate Preview
  const generatePreview = async () => {
    setStage('loading');
    setPreviewError(null);

    try {
      const monthStart = parseMonth(selectedMonth);
      const monthEnd = endOfMonth(monthStart);

      const response = await callEdgeFunction('preview-invoices', {
        periodStart: format(monthStart, 'yyyy-MM-dd'),
        periodEnd: format(monthEnd, 'yyyy-MM-dd'),
        createdBy: accounts[0]?.username || accounts[0]?.name || 'unknown',
      });

      if (!response.success) {
        throw new Error(response.error || 'Preview generation failed');
      }

      if (!response.batchId || response.customers.length === 0) {
        setPreviewError(response.message || 'No billable time entries found for this period.');
        setStage('config');
        return;
      }

      setBatchId(response.batchId);
      setPreviews(response.customers);
      setSummary(response.summary);
      setStage('preview');

      // Fetch profitability margins for the invoice period from customer_profitability
      const periodStart = format(monthStart, 'yyyy-MM-dd');
      const periodEnd = format(monthEnd, 'yyyy-MM-dd');

      const { data: cpData } = await supabase
        .from('customer_profitability')
        .select('qb_customer_id, margin_percent')
        .gte('week_start', periodStart)
        .lte('week_start', periodEnd);

      if (cpData) {
        const marginMap: Record<string, number[]> = {};
        for (const s of cpData) {
          if (!marginMap[s.qb_customer_id]) marginMap[s.qb_customer_id] = [];
          marginMap[s.qb_customer_id].push(Number(s.margin_percent));
        }
        const avgMargins: Record<string, number> = {};
        for (const [cid, vals] of Object.entries(marginMap)) {
          avgMargins[cid] = vals.reduce((a, b) => a + b, 0) / vals.length;
        }
        setMargins(avgMargins);
      }

      // Check for disputed reports in the period
      const { data: disputed } = await supabase
        .from('report_periods')
        .select('qb_customer_id')
        .eq('status', 'disputed')
        .gte('week_start', periodStart)
        .lte('week_end', periodEnd);

      if (disputed) {
        setDisputedCustomers(new Set(disputed.map(d => d.qb_customer_id)));
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to generate preview');
      setStage('config');
    }
  };

  // Execute Approved
  const executeApproved = async () => {
    const approvals = previews
      .filter(p => p.action !== 'pending')
      .map(p => ({ stagingId: p.stagingId, action: p.action }));

    if (approvals.length === 0) return;

    setStage('executing');
    setExecutingIndex(0);
    setExecuteError(null);

    try {
      const response = await callEdgeFunction('execute-invoices', {
        batchId,
        approvals,
        executedBy: 'sharon',
      });

      if (!response.success) {
        throw new Error(response.error || 'Execution failed');
      }

      setExecutionResults(response.results);
      setExecutionSummary(response.summary);
      setStage('results');
    } catch (err) {
      setExecuteError(err instanceof Error ? err.message : 'Failed to execute invoices');
      setStage('results');
    }
  };

  // Reset to config
  const resetToConfig = () => {
    setStage('config');
    setBatchId(null);
    setPreviews([]);
    setSummary(null);
    setPreviewError(null);
    setExecutionResults([]);
    setExecutionSummary(null);
    setExecuteError(null);
  };

  return (
    <AppShell>
      <PageHeader
        title="Monthly Invoices"
        subtitle="Preview, compare, and create invoices in QuickBooks Online"
        icon={<DollarSign className="w-6 h-6 text-purple-600" />}
      />

        {/* ===== STAGE: CONFIG ===== */}
        {stage === 'config' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Create Monthly Invoices</h2>
                  <p className="text-sm text-gray-600">Preview and approve invoices before sending to QuickBooks</p>
                </div>
              </div>

              <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <h3 className="font-semibold text-purple-900 mb-2">How it works:</h3>
                <ol className="text-sm text-purple-800 space-y-1 list-decimal list-inside">
                  <li>Select a billing month and click &ldquo;Generate Preview&rdquo;</li>
                  <li>Review each customer&apos;s invoice &mdash; we check QB for existing invoices</li>
                  <li>Choose to Create, Update, or Skip each customer</li>
                  <li>Click &ldquo;Execute Approved&rdquo; to create/update only what you approved</li>
                </ol>
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
                  Period: {format(parseMonth(selectedMonth), 'MMMM yyyy')}
                </p>
              </div>

              {previewError && (
                <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800">{previewError}</p>
                </div>
              )}

              <button
                onClick={generatePreview}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-purple-700 transition-all duration-200"
              >
                <Search className="w-5 h-5" />
                Generate Preview
              </button>

              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">What happens:</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>- Analyzes all billable time entries for the selected month</li>
                  <li>- Checks QuickBooks for existing invoices in that period</li>
                  <li>- Shows a comparison so you can decide what to create or skip</li>
                  <li>- Nothing touches QuickBooks until you click &ldquo;Execute Approved&rdquo;</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ===== STAGE: LOADING ===== */}
        {stage === 'loading' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Analyzing Invoices</h2>
              <p className="text-gray-600">Checking time entries and comparing with QuickBooks...</p>
            </div>
          </div>
        )}

        {/* ===== STAGE: PREVIEW ===== */}
        {stage === 'preview' && (
          <div>
            {/* Summary Bar */}
            {summary && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{summary.totalCustomers}</div>
                      <div className="text-xs text-gray-500">Total Customers</div>
                    </div>
                    {summary.newInvoices > 0 && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{summary.newInvoices}</div>
                        <div className="text-xs text-gray-500">New Invoices</div>
                      </div>
                    )}
                    {summary.existsDifferent > 0 && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-amber-600">{summary.existsDifferent}</div>
                        <div className="text-xs text-gray-500">Needs Review</div>
                      </div>
                    )}
                    {summary.existsMatch > 0 && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{summary.existsMatch}</div>
                        <div className="text-xs text-gray-500">Matches QB</div>
                      </div>
                    )}
                    {summary.alreadyLogged > 0 && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-400">{summary.alreadyLogged}</div>
                        <div className="text-xs text-gray-500">Already Created</div>
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">
                    {format(parseMonth(selectedMonth), 'MMMM yyyy')}
                  </div>
                </div>
              </div>
            )}

            {/* Missing Rates Warning */}
            {summary && summary.missingRates > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-red-800 font-semibold">
                    {summary.missingRates} time entries across {summary.customersWithMissingRates} customers are missing service items
                  </p>
                  <p className="text-red-700 text-sm mt-1">
                    These entries have no rate assigned and will bill at $0. Assign service items in QuickBooks
                    and re-sync before creating invoices. Affected customers are defaulted to &ldquo;Skip&rdquo;.
                  </p>
                </div>
              </div>
            )}

            {/* Per-Customer Cards */}
            <div className="space-y-3 mb-24">
              {previews.map((preview) => (
                <InvoicePreviewCard
                  key={preview.stagingId}
                  preview={preview}
                  onActionChange={handleActionChange}
                  marginPercent={margins[preview.qbCustomerId] ?? null}
                  hasDisputedReports={disputedCustomers.has(preview.qbCustomerId)}
                />
              ))}
            </div>

            {/* Sticky Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="flex items-center justify-between">
                  <button
                    onClick={resetToConfig}
                    className="px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <ArrowLeft className="w-4 h-4 inline mr-1" />
                    Back
                  </button>

                  <div className="flex items-center gap-4 text-sm">
                    {actionCounts.create_new > 0 && (
                      <span className="flex items-center gap-1 text-green-700">
                        <Plus className="w-4 h-4" /> {actionCounts.create_new} to create
                      </span>
                    )}
                    {actionCounts.update_existing > 0 && (
                      <span className="flex items-center gap-1 text-blue-700">
                        <RefreshCw className="w-4 h-4" /> {actionCounts.update_existing} to update
                      </span>
                    )}
                    {actionCounts.skip > 0 && (
                      <span className="flex items-center gap-1 text-gray-500">
                        <SkipForward className="w-4 h-4" /> {actionCounts.skip} to skip
                      </span>
                    )}
                    {actionCounts.pending > 0 && (
                      <span className="flex items-center gap-1 text-amber-600">
                        <AlertTriangle className="w-4 h-4" /> {actionCounts.pending} undecided
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setAllActions('skip')}
                      className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Skip All
                    </button>
                    <button
                      onClick={executeApproved}
                      disabled={!canExecute}
                      className="px-6 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Execute Approved
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== STAGE: EXECUTING ===== */}
        {stage === 'executing' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Creating Invoices</h2>
              <p className="text-gray-600">
                Processing invoices in QuickBooks...
              </p>
              <p className="text-sm text-gray-400 mt-2">Please do not close this page</p>
            </div>
          </div>
        )}

        {/* ===== STAGE: RESULTS ===== */}
        {stage === 'results' && (
          <div className="max-w-4xl mx-auto">
            {executeError && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-medium">Execution Error</p>
                <p className="text-red-700 text-sm mt-1">{executeError}</p>
              </div>
            )}

            {/* Summary */}
            {executionSummary && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Execution Summary</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {executionSummary.created > 0 && (
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-green-700">{executionSummary.created}</div>
                      <div className="text-xs text-green-600">Created</div>
                    </div>
                  )}
                  {executionSummary.updated > 0 && (
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-blue-700">{executionSummary.updated}</div>
                      <div className="text-xs text-blue-600">Updated</div>
                    </div>
                  )}
                  {executionSummary.skipped > 0 && (
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-gray-500">{executionSummary.skipped}</div>
                      <div className="text-xs text-gray-500">Skipped</div>
                    </div>
                  )}
                  {executionSummary.failed > 0 && (
                    <div className="bg-red-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-red-700">{executionSummary.failed}</div>
                      <div className="text-xs text-red-600">Failed</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Per-customer results */}
            {executionResults.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900">Details</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {executionResults.map((result, idx) => (
                    <div key={idx} className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {result.status === 'success' && <CheckCircle className="w-5 h-5 text-green-500" />}
                        {result.status === 'failed' && <XCircle className="w-5 h-5 text-red-500" />}
                        {result.status === 'skipped' && <SkipForward className="w-5 h-5 text-gray-400" />}
                        <div>
                          <div className="font-medium text-gray-900">{result.customerName}</div>
                          <div className="text-sm text-gray-500">
                            {result.action === 'create_new' && 'Created new invoice'}
                            {result.action === 'update_existing' && 'Updated existing invoice'}
                            {result.action === 'skip' && 'Skipped'}
                            {result.invoiceNumber && ` #${result.invoiceNumber}`}
                            {result.error && <span className="text-red-600"> - {result.error}</span>}
                          </div>
                        </div>
                      </div>
                      {result.total && (
                        <div className="text-right font-medium text-gray-900">
                          ${result.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={resetToConfig}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-purple-700 transition-all duration-200"
            >
              Done
            </button>
          </div>
        )}
    </AppShell>
  );
}
