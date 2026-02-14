'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { callEdgeFunction } from '@/lib/supabaseClient';
import { parsePnlSummary, type PnlSection, type PnlLineItem } from '@/lib/qbReportParser';
import { fmtMoneyAccounting as fmtMoney } from '@/lib/utils';

// Highlight bar styles by group
const HIGHLIGHT_GROUPS: Record<string, { label: string; bgClass: string; textClass: string }> = {
  GrossProfit: { label: 'Gross Profit', bgClass: 'bg-blue-50 border-blue-200', textClass: 'text-blue-800' },
  NetOperatingIncome: { label: 'Net Operating Income', bgClass: 'bg-purple-50 border-purple-200', textClass: 'text-purple-800' },
  NetOtherIncome: { label: 'Net Other Income', bgClass: 'bg-gray-50 border-gray-200', textClass: 'text-gray-800' },
  NetIncome: { label: 'Net Income', bgClass: 'bg-green-50 border-green-200', textClass: '' },
};

interface Props {
  startDate: string;
  endDate: string;
}

export default function PnlSummaryView({ startDate, endDate }: Props) {
  const [sections, setSections] = useState<PnlSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reportHeader, setReportHeader] = useState<any>(null);

  useEffect(() => {
    if (!startDate || !endDate) return;
    let cancelled = false;

    setLoading(true);
    setError('');

    callEdgeFunction('qb-reports', { report: 'ProfitAndLoss', startDate, endDate })
      .then(result => {
        if (cancelled) return;
        if (!result.success) {
          setError(result.error || 'Failed to load P&L');
          return;
        }
        setReportHeader(result.report?.Header);
        const parsed = parsePnlSummary(result.report);
        setSections(parsed);
      })
      .catch(err => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [startDate, endDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-purple-600 mr-2" />
        <span className="text-sm text-gray-600">Loading P&L from QuickBooks...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-red-800">Failed to load P&L report</p>
          <p className="text-sm text-red-600 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No P&L data available for this period.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Report header */}
      {reportHeader && (
        <div className="text-center mb-4">
          <h3 className="text-lg font-bold text-gray-900">Profit and Loss</h3>
          <p className="text-sm text-gray-500">
            {reportHeader.StartPeriod} to {reportHeader.EndPeriod} ({reportHeader.ReportBasis} Basis)
          </p>
        </div>
      )}

      {sections.map((section, i) => {
        const highlight = HIGHLIGHT_GROUPS[section.group];

        // Summary-only row (Gross Profit, Net Income, etc.)
        if (section.isSummaryOnly) {
          const isNetIncome = section.group === 'NetIncome';
          const textColor = isNetIncome
            ? section.total >= 0 ? 'text-green-700' : 'text-red-700'
            : highlight?.textClass || 'text-gray-900';

          return (
            <div
              key={i}
              className={`flex justify-between items-center px-4 py-3 rounded-lg border font-bold ${
                highlight?.bgClass || 'bg-gray-50 border-gray-200'
              }`}
            >
              <span className={textColor}>{section.label}</span>
              <span className={textColor}>{fmtMoney(section.total)}</span>
            </div>
          );
        }

        // Regular section with line items
        return <SectionBlock key={i} section={section} />;
      })}
    </div>
  );
}

function SectionBlock({ section }: { section: PnlSection }) {
  const [collapsed, setCollapsed] = useState(false);

  // Color the section header based on group
  const isIncome = section.group === 'Income';
  const isCOGS = section.group === 'COGS';
  const headerColor = isIncome ? 'text-green-800' : isCOGS ? 'text-orange-800' : 'text-gray-800';
  const totalColor = isIncome ? 'text-green-700' : 'text-red-700';

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Section header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          {collapsed ? <ChevronRight className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          <span className={`font-semibold ${headerColor}`}>{section.label}</span>
        </div>
        <span className={`font-semibold ${totalColor}`}>{fmtMoney(section.total)}</span>
      </button>

      {/* Line items */}
      {!collapsed && (
        <div className="border-t border-gray-100">
          {section.items.map((item, i) => (
            <LineItemRow key={i} item={item} depth={0} />
          ))}
          {/* Section total */}
          <div className="flex justify-between px-4 py-2 bg-gray-50 border-t border-gray-200 font-semibold text-sm">
            <span className="text-gray-700">Total {section.label}</span>
            <span className={totalColor}>{fmtMoney(section.total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function LineItemRow({ item, depth }: { item: PnlLineItem; depth: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = item.children && item.children.length > 0;
  const indent = depth * 16 + 16;

  return (
    <>
      <div
        className={`flex items-center justify-between px-4 py-1.5 text-sm hover:bg-gray-50 ${hasChildren ? 'cursor-pointer' : ''}`}
        style={{ paddingLeft: `${indent}px` }}
        onClick={hasChildren ? () => setExpanded(!expanded) : undefined}
      >
        <div className="flex items-center gap-1.5">
          {hasChildren && (
            expanded
              ? <ChevronDown className="w-3 h-3 text-gray-400" />
              : <ChevronRight className="w-3 h-3 text-gray-400" />
          )}
          <span className={`${hasChildren ? 'font-medium text-gray-800' : 'text-gray-700'}`}>
            {item.name}
          </span>
        </div>
        <span className="text-gray-900 tabular-nums">{fmtMoney(item.amount)}</span>
      </div>
      {hasChildren && expanded && item.children!.map((child, i) => (
        <LineItemRow key={i} item={child} depth={depth + 1} />
      ))}
    </>
  );
}
