'use client';

import { useState } from 'react';
import { Scale, Search, Printer, AlertCircle } from 'lucide-react';
import { callEdgeFunction } from '@/lib/supabaseClient';
import { CustomerSelect } from '@/components/forms/CustomerSelect';
import { DateRangePicker } from '@/components/DateRangePicker';
import { EXTENDED_PRESETS, computeDateRange } from '@/lib/datePresets';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';

interface InvoiceLine {
  Description: string;
  Amount: number;
  Qty: number;
  Rate: number;
  ItemName: string;
}

interface Invoice {
  Id: string;
  DocNumber: string;
  TxnDate: string;
  TotalAmt: number;
  Balance: number;
  Lines: InvoiceLine[];
}

interface TimeEntry {
  TxnDate: string;
  EmployeeName: string;
  Hours: number;
  Minutes: number;
  StartTime: string | null;
  EndTime: string | null;
  ServiceItem: string;
  BillableStatus: string;
  DurationMatch: boolean | null;
}

interface ReportData {
  customer: { name: string; id: string };
  dateRange: { start: string; end: string };
  invoices: Invoice[];
  timeEntries: TimeEntry[];
  summary: {
    totalInvoiced: number;
    totalPaid: number;
    totalOutstanding: number;
    invoiceCount: number;
    totalHours: number;
    entryCount: number;
    entriesWithClockTimes: number;
    entriesWithDurationMismatch: number;
  };
}

function fmtMoney(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function fmtTime(iso: string | null): string {
  if (!iso) return '\u2014';
  const d = new Date(iso);
  const et = new Date(d.getTime() - 5 * 60 * 60 * 1000);
  let h = et.getUTCHours();
  const m = et.getUTCMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function fmtDate(d: string): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const parts = d.split('-');
  return `${months[parseInt(parts[1])-1]} ${parseInt(parts[2])}, ${parts[0]}`;
}

function shortName(name: string): string {
  if (name.startsWith('R. David') || name.startsWith('Robert David')) return 'R.D. Sweet';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return name;
  const suffixes = ['II','III','IV','Jr','Sr'];
  const suffix = suffixes.includes(parts[parts.length - 1]) ? ' ' + parts.pop()! : '';
  const lastName = parts[parts.length - 1];
  return `${parts[0][0]}. ${lastName}${suffix}`;
}

function cleanService(name: string | null): string {
  if (!name) return 'Professional Services';
  if (name.includes('AccessResto')) return 'Professional Services';
  if (name.includes(':')) name = name.split(':').pop()!.trim();
  return name;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Consulting': 'bg-emerald-100 text-emerald-700',
  'Estimator/PM': 'bg-indigo-100 text-indigo-700',
  'Data Analyst': 'bg-purple-100 text-purple-700',
  'Administrative': 'bg-gray-100 text-gray-600',
  'Deposition Prep': 'bg-amber-100 text-amber-700',
  'Deposition': 'bg-amber-100 text-amber-700',
  'Written Report': 'bg-pink-100 text-pink-700',
  'Project Manager': 'bg-indigo-100 text-indigo-700',
  'Pre-Trial Preparation': 'bg-red-100 text-red-700',
  'Umpire Services': 'bg-blue-100 text-blue-700',
  'On-Site': 'bg-blue-100 text-blue-700',
};

function categoryBadge(cat: string) {
  const color = CATEGORY_COLORS[cat] || 'bg-gray-100 text-gray-600';
  return `inline-block px-2 py-0.5 rounded text-xs font-semibold ${color}`;
}

export function CounselBillingReport() {
  const [customerId, setCustomerId] = useState('');
  const [activePreset, setActivePreset] = useState('all_time');
  const [dateRange, setDateRange] = useState(() => computeDateRange('all_time'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);

  const handlePresetChange = (preset: string) => {
    setActivePreset(preset);
    const range = computeDateRange(preset);
    setDateRange(range);
  };

  const handleStartDateChange = (date: string) => {
    setActivePreset('custom');
    setDateRange(prev => ({ ...prev, startDate: date }));
  };

  const handleEndDateChange = (date: string) => {
    setActivePreset('custom');
    setDateRange(prev => ({ ...prev, endDate: date }));
  };

  const generateReport = async () => {
    if (!customerId) {
      setError('Please select a customer');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setReportData(null);

      const result = await callEdgeFunction('counsel-billing-summary', {
        customerId,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });

      setReportData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Group time entries by invoice period
  function getEntriesForInvoice(inv: Invoice, entries: TimeEntry[]): TimeEntry[] {
    // Match entries within a reasonable window around the invoice date
    // Since QB invoices cover a billing period, use the line item dates or invoice month
    const invDate = new Date(inv.TxnDate);
    const monthStart = new Date(invDate.getFullYear(), invDate.getMonth(), 1);
    const monthEnd = new Date(invDate.getFullYear(), invDate.getMonth() + 1, 0);
    const start = monthStart.toISOString().slice(0, 10);
    const end = monthEnd.toISOString().slice(0, 10);
    return entries.filter(e => e.TxnDate >= start && e.TxnDate <= end);
  }

  return (
    <>
      {/* Config Panel */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <Scale className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Counsel Billing Summary</h2>
            <p className="text-sm text-gray-600">Comprehensive billing summary for opposing counsel — invoices and time records, no notes</p>
          </div>
        </div>

        <div className="space-y-6">
          <CustomerSelect
            value={customerId}
            onChange={(v) => { setCustomerId(v); setReportData(null); }}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
            <DateRangePicker
              presets={EXTENDED_PRESETS}
              activePreset={activePreset}
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
              onPresetChange={handlePresetChange}
              onStartDateChange={handleStartDateChange}
              onEndDateChange={handleEndDateChange}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={generateReport}
            disabled={loading || !customerId}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> Generating...</>
            ) : (
              <><Search className="w-5 h-5" /> Generate Report</>
            )}
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="mt-8">
          <LoadingSkeleton variant="table" rows={6} columns={5} />
        </div>
      )}

      {/* Report Preview */}
      {reportData && !loading && (
        <div className="mt-8 print:mt-0">
          {/* Action bar (hidden in print) */}
          <div className="flex items-center justify-between mb-4 print:hidden">
            <h3 className="text-lg font-semibold text-gray-900">Report Preview</h3>
            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                <Printer className="w-4 h-4" /> Print / Save PDF
              </button>
            </div>
          </div>

          {/* Report Content */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-0 print:rounded-none" id="counsel-report">
            {/* Header */}
            <div className="border-b-4 border-blue-600 p-8 print:p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-blue-800">MIT Consulting Services</h1>
                  <p className="text-sm text-gray-500 mt-1">Property Health &bull; Inspection &amp; Remediation</p>
                </div>
                <div className="text-right text-sm text-gray-600">
                  <p className="font-semibold text-gray-900">Comprehensive Billing Summary</p>
                  <p>Report Date: {fmtDate(new Date().toISOString().slice(0, 10))}</p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 font-medium">Client / Matter</span>
                  <p className="font-semibold text-gray-900">{reportData.customer.name}</p>
                </div>
                <div>
                  <span className="text-gray-500 font-medium">Reporting Period</span>
                  <p className="font-semibold text-gray-900">{fmtDate(reportData.dateRange.start)} &mdash; {fmtDate(reportData.dateRange.end)}</p>
                </div>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4 p-6 bg-gray-50 border-b border-gray-200">
              <div className="text-center">
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Total Invoiced</div>
                <div className="text-xl font-bold text-blue-700">{fmtMoney(reportData.summary.totalInvoiced)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Outstanding</div>
                <div className="text-xl font-bold text-amber-600">{fmtMoney(reportData.summary.totalOutstanding)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Total Hours</div>
                <div className="text-xl font-bold text-gray-800">{reportData.summary.totalHours.toFixed(2)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Invoices</div>
                <div className="text-xl font-bold text-gray-800">{reportData.summary.invoiceCount}</div>
              </div>
            </div>

            {/* Sanity Check Banner (print-hidden) */}
            {(reportData.summary.entriesWithDurationMismatch > 0 || reportData.summary.entriesWithClockTimes < reportData.summary.entryCount) && (
              <div className="mx-6 mt-4 print:hidden">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
                  <h4 className="font-semibold text-amber-800 mb-1 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" /> Clock Time Coverage
                  </h4>
                  <p className="text-amber-700">
                    {reportData.summary.entriesWithClockTimes} of {reportData.summary.entryCount} entries have clock-in/clock-out times.
                    {reportData.summary.entryCount - reportData.summary.entriesWithClockTimes > 0 && (
                      <> {reportData.summary.entryCount - reportData.summary.entriesWithClockTimes} entries were manually entered without clock times.</>
                    )}
                  </p>
                  {reportData.summary.entriesWithDurationMismatch > 0 && (
                    <p className="text-red-700 mt-1 font-medium">
                      {reportData.summary.entriesWithDurationMismatch} entries have a duration mismatch between clock times and recorded hours (marked with ⚠).
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Invoice Summary Table */}
            <div className="p-6">
              <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wide border-b-2 border-blue-600 pb-1 mb-4">Invoice Summary</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-blue-800 uppercase tracking-wide">
                    <th className="text-left py-2 px-3 bg-gray-50">Invoice #</th>
                    <th className="text-left py-2 px-3 bg-gray-50">Date</th>
                    <th className="text-center py-2 px-3 bg-gray-50">Status</th>
                    <th className="text-right py-2 px-3 bg-gray-50">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.invoices.map((inv) => (
                    <tr key={inv.Id} className="border-b border-gray-100">
                      <td className="py-2 px-3 font-mono text-xs">{inv.DocNumber}</td>
                      <td className="py-2 px-3">{fmtDate(inv.TxnDate)}</td>
                      <td className="py-2 px-3 text-center">
                        {inv.Balance === 0 ? (
                          <span className="text-xs font-semibold text-green-600">Paid</span>
                        ) : (
                          <span className="text-xs font-semibold text-amber-600">Open</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">{fmtMoney(inv.TotalAmt)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-blue-600 font-bold text-blue-800">
                    <td colSpan={3} className="py-2 px-3">Total &mdash; {reportData.invoices.length} Invoices</td>
                    <td className="py-2 px-3 text-right font-mono">{fmtMoney(reportData.summary.totalInvoiced)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Invoice Detail + Time Records */}
            <div className="p-6 pt-0">
              <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wide border-b-2 border-blue-600 pb-1 mb-4">Invoice Detail &mdash; Time Records</h3>

              {reportData.invoices.map((inv) => {
                const entries = getEntriesForInvoice(inv, reportData.timeEntries);
                return (
                  <div key={inv.Id} className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
                    <div className={`px-4 py-2 flex justify-between items-center text-white text-sm font-bold ${inv.Balance === 0 ? 'bg-gradient-to-r from-blue-700 to-blue-500' : 'bg-gradient-to-r from-amber-700 to-amber-500'}`}>
                      <span>Invoice #{inv.DocNumber}</span>
                      <span>{fmtMoney(inv.TotalAmt)}</span>
                    </div>
                    <div className="flex gap-4 px-4 py-1.5 bg-gray-50 border-b text-xs text-gray-500">
                      <span>Issued: <strong className="text-gray-700">{fmtDate(inv.TxnDate)}</strong></span>
                      <span>Status: <strong className={inv.Balance === 0 ? 'text-green-600' : 'text-amber-600'}>{inv.Balance === 0 ? 'Paid' : 'Open'}</strong></span>
                    </div>

                    {/* QB Line Items */}
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[10px] uppercase text-gray-500 tracking-wide">
                          <th className="text-left py-1.5 px-3">Category</th>
                          <th className="text-right py-1.5 px-3">Rate</th>
                          <th className="text-right py-1.5 px-3">Qty/Hrs</th>
                          <th className="text-right py-1.5 px-3">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inv.Lines.map((ln, i) => (
                          <tr key={i} className="border-b border-gray-50">
                            <td className="py-1 px-3"><span className={categoryBadge(cleanService(ln.ItemName))}>{cleanService(ln.ItemName)}</span></td>
                            <td className="py-1 px-3 text-right font-mono">{ln.Rate ? fmtMoney(ln.Rate) : '\u2014'}</td>
                            <td className="py-1 px-3 text-right">{ln.Qty?.toFixed(2) || '\u2014'}</td>
                            <td className="py-1 px-3 text-right font-mono">{fmtMoney(ln.Amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Time Records */}
                    {entries.length > 0 && (
                      <>
                        <div className="bg-blue-50 px-3 py-1.5 text-[10px] font-bold text-blue-800 uppercase tracking-wide border-t border-blue-200">
                          Time Records ({entries.length} entries)
                        </div>
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-[10px] uppercase text-gray-400 tracking-wide">
                              <th className="text-left py-1 px-3">Date</th>
                              <th className="text-left py-1 px-3">Professional</th>
                              <th className="text-left py-1 px-3">Start</th>
                              <th className="text-left py-1 px-3">End</th>
                              <th className="text-left py-1 px-3">Category</th>
                              <th className="text-right py-1 px-3">Hours</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entries.map((e, i) => (
                              <tr key={i} className="border-b border-gray-50 text-gray-600">
                                <td className="py-0.5 px-3">{e.TxnDate.slice(5)}</td>
                                <td className="py-0.5 px-3">{shortName(e.EmployeeName)}</td>
                                <td className="py-0.5 px-3 font-mono text-[10px]">{fmtTime(e.StartTime)}</td>
                                <td className="py-0.5 px-3 font-mono text-[10px]">{fmtTime(e.EndTime)}</td>
                                <td className="py-0.5 px-3"><span className={categoryBadge(cleanService(e.ServiceItem))}>{cleanService(e.ServiceItem)}</span></td>
                                <td className="py-0.5 px-3 text-right">
                                {(e.Hours + e.Minutes / 60).toFixed(2)}
                                {e.DurationMatch === false && <span className="ml-1 text-red-500" title="Clock duration does not match recorded hours">⚠</span>}
                              </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 border-t border-gray-200 p-6 text-center text-xs text-gray-500">
              <p className="font-bold text-blue-800">MIT Consulting Services &mdash; Mitigation Information Technologies</p>
              <p>This report is provided for litigation support purposes. All times reflect actual clock-in/clock-out records where available.</p>
              <p className="mt-1 italic">Confidential &mdash; Attorney Work Product</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
