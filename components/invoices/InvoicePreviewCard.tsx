'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  RefreshCw,
  SkipForward,
  CheckCircle,
  AlertTriangle,
  FileText,
  DollarSign,
} from 'lucide-react';

export interface CustomerPreview {
  stagingId: number;
  customerId: number;
  qbCustomerId: string;
  customerName: string;
  totalHours: number;
  totalAmount: number;
  lineItems: any[];
  lineItemCount: number;
  missingRateCount: number;
  qbExistingInvoiceId: string | null;
  qbExistingInvoiceNumber: string | null;
  qbExistingTotal: number | null;
  comparisonStatus: 'new' | 'exists_match' | 'exists_different' | 'already_logged';
  differences: {
    ourTotal: number;
    qbTotal: number;
    difference: number;
    ourLineCount: number;
    qbLineCount: number;
  } | null;
  action: string;
}

interface Props {
  preview: CustomerPreview;
  onActionChange: (stagingId: number, action: string) => void;
}

const STATUS_CONFIG = {
  new: {
    label: 'New Invoice',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    badgeBg: 'bg-green-100',
    badgeText: 'text-green-800',
    icon: Plus,
  },
  exists_match: {
    label: 'Matches QB',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-800',
    icon: CheckCircle,
  },
  exists_different: {
    label: 'Differences Found',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
    icon: AlertTriangle,
  },
  already_logged: {
    label: 'Already Created',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    badgeBg: 'bg-gray-100',
    badgeText: 'text-gray-600',
    icon: FileText,
  },
};

export default function InvoicePreviewCard({ preview, onActionChange }: Props) {
  const [expanded, setExpanded] = useState(preview.missingRateCount > 0);
  const config = STATUS_CONFIG[preview.comparisonStatus];
  const StatusIcon = config.icon;

  const availableActions = getAvailableActions(preview.comparisonStatus);

  // Sort line items: missing rates first, then by date
  const sortedLineItems = [...preview.lineItems].sort((a: any, b: any) => {
    const aMissing = a._display?.missingRate ? 0 : 1;
    const bMissing = b._display?.missingRate ? 0 : 1;
    if (aMissing !== bMissing) return aMissing - bMissing;
    return (a._display?.date || '').localeCompare(b._display?.date || '');
  });

  return (
    <div className={`rounded-lg border ${config.borderColor} ${config.bgColor} overflow-hidden`}>
      {/* Card Header */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-gray-500 hover:text-gray-700 flex-shrink-0"
            >
              {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-gray-900 truncate">{preview.customerName}</h3>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.badgeBg} ${config.badgeText}`}>
                  <StatusIcon className="w-3 h-3" />
                  {config.label}
                </span>
              </div>

              <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                <span>{preview.lineItemCount} line items</span>
                <span>{preview.totalHours.toFixed(1)} hours</span>
                <span className="font-medium text-gray-900">
                  ${preview.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Missing rate warning */}
              {preview.missingRateCount > 0 && (
                <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-sm text-red-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    <strong>{preview.missingRateCount} of {preview.lineItemCount} entries missing service item/rate</strong>
                    {' '}&mdash; these will bill at $0. Assign service items in QuickBooks before invoicing.
                  </span>
                </div>
              )}

              {/* Show QB existing info */}
              {preview.qbExistingInvoiceId && (
                <div className="mt-1 text-sm text-gray-500">
                  QB Invoice #{preview.qbExistingInvoiceNumber} &mdash; ${preview.qbExistingTotal?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              )}

              {/* Show differences */}
              {preview.comparisonStatus === 'exists_different' && preview.differences && (
                <div className="mt-2 p-2 bg-amber-100 rounded text-sm text-amber-900">
                  <strong>Difference:</strong>{' '}
                  Our total: ${preview.differences.ourTotal.toFixed(2)} vs QB: ${preview.differences.qbTotal.toFixed(2)}{' '}
                  ({preview.differences.difference > 0 ? '+' : ''}${preview.differences.difference.toFixed(2)})
                  {preview.differences.ourLineCount !== preview.differences.qbLineCount && (
                    <span className="ml-2">
                      | Lines: {preview.differences.ourLineCount} vs {preview.differences.qbLineCount}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action Selector */}
          <div className="flex-shrink-0 ml-4">
            <select
              value={preview.action}
              onChange={(e) => onActionChange(preview.stagingId, e.target.value)}
              className="block w-40 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {availableActions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Expandable Line Items */}
      {expanded && (
        <div className="border-t border-gray-200 bg-white p-4">
          {preview.missingRateCount > 0 && preview.missingRateCount < preview.lineItemCount && (
            <div className="px-4 pt-3 pb-1 text-xs font-semibold text-red-700 uppercase tracking-wide">
              Missing Service Item ({preview.missingRateCount})
            </div>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Employee</th>
                <th className="pb-2 font-medium">Time</th>
                <th className="pb-2 font-medium">Service Item</th>
                <th className="pb-2 font-medium text-right">Hours</th>
                <th className="pb-2 font-medium text-right">Rate</th>
                <th className="pb-2 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {sortedLineItems.map((item: any, idx: number) => {
                const d = item._display || {};
                const isMissing = d.missingRate;
                // Show separator between missing and assigned sections
                const prevItem = idx > 0 ? sortedLineItems[idx - 1]?._display : null;
                const showDivider = idx > 0 && prevItem?.missingRate && !isMissing;
                return (
                  <>
                    {showDivider && (
                      <tr key={`div-${idx}`}>
                        <td colSpan={7} className="py-1">
                          <div className="border-t-2 border-gray-300 pt-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Assigned ({preview.lineItemCount - preview.missingRateCount})
                          </div>
                        </td>
                      </tr>
                    )}
                    <tr key={idx} className={`border-b ${isMissing ? 'bg-red-50 border-red-100' : 'border-gray-100'}`}>
                      <td className="py-2 text-gray-700">{d.date || '-'}</td>
                      <td className="py-2 text-gray-700">{d.employee || '-'}</td>
                      <td className="py-2 text-gray-500 text-xs">{d.timeDetail || '-'}</td>
                      <td className={`py-2 ${isMissing ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
                        {d.service || '-'}
                      </td>
                      <td className="py-2 text-right text-gray-700">{d.hours?.toFixed(2) || '-'}</td>
                      <td className={`py-2 text-right ${isMissing ? 'text-red-600' : 'text-gray-700'}`}>
                        {isMissing ? 'N/A' : `$${d.rate?.toFixed(2) || '-'}`}
                      </td>
                      <td className={`py-2 text-right font-medium ${isMissing ? 'text-red-600' : 'text-gray-900'}`}>
                        {isMissing ? '$0.00' : `$${d.amount?.toFixed(2) || '-'}`}
                      </td>
                    </tr>
                  </>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td colSpan={4} className="pt-2 text-gray-900">Total</td>
                <td className="pt-2 text-right text-gray-900">{preview.totalHours.toFixed(2)}</td>
                <td className="pt-2"></td>
                <td className="pt-2 text-right text-gray-900">
                  ${preview.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function getAvailableActions(status: string): { value: string; label: string }[] {
  switch (status) {
    case 'new':
      return [
        { value: 'create_new', label: 'Create New' },
        { value: 'skip', label: 'Skip' },
      ];
    case 'exists_match':
      return [
        { value: 'skip', label: 'Skip (Matches)' },
        { value: 'update_existing', label: 'Update Existing' },
        { value: 'create_new', label: 'Create Duplicate' },
      ];
    case 'exists_different':
      return [
        { value: 'pending', label: 'Decide...' },
        { value: 'update_existing', label: 'Update Existing' },
        { value: 'create_new', label: 'Create New' },
        { value: 'skip', label: 'Skip' },
      ];
    case 'already_logged':
      return [
        { value: 'skip', label: 'Skip (Already Done)' },
        { value: 'create_new', label: 'Create Another' },
      ];
    default:
      return [
        { value: 'pending', label: 'Decide...' },
        { value: 'create_new', label: 'Create New' },
        { value: 'skip', label: 'Skip' },
      ];
  }
}
