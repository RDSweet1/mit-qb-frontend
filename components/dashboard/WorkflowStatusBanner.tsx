'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Clock,
  FileText,
  CheckSquare,
  Receipt,
  AlertCircle,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface StageCount {
  count: number;
  loading: boolean;
}

interface WorkflowData {
  timePending: StageCount;
  reportsUnsent: StageCount;
  awaitingClient: StageCount;
  readyToInvoice: StageCount;
  arOverdue: StageCount;
}

function StageCell({
  icon: Icon,
  label,
  sublabel,
  count,
  loading,
  href,
  urgency,
}: {
  icon: React.ElementType;
  label: string;
  sublabel: string;
  count: number;
  loading: boolean;
  href: string;
  urgency: 'none' | 'info' | 'warn' | 'urgent';
}) {
  const colors = {
    none:   { bg: 'bg-green-50',  border: 'border-green-200',  icon: 'text-green-500',  badge: 'bg-green-100 text-green-700',  count: 'text-green-700' },
    info:   { bg: 'bg-blue-50',   border: 'border-blue-200',   icon: 'text-blue-500',   badge: 'bg-blue-100 text-blue-700',    count: 'text-blue-700' },
    warn:   { bg: 'bg-amber-50',  border: 'border-amber-200',  icon: 'text-amber-500',  badge: 'bg-amber-100 text-amber-700',  count: 'text-amber-700' },
    urgent: { bg: 'bg-red-50',    border: 'border-red-200',    icon: 'text-red-500',    badge: 'bg-red-100 text-red-700',      count: 'text-red-700' },
  };
  const c = colors[urgency];

  return (
    <Link href={href} className="group flex-1 min-w-0">
      <div className={`h-full flex flex-col gap-1 px-4 py-3 rounded-lg border ${c.bg} ${c.border} hover:shadow-sm transition-shadow`}>
        <div className="flex items-center justify-between">
          <Icon className={`w-4 h-4 flex-shrink-0 ${c.icon}`} />
          {loading ? (
            <div className="w-6 h-4 bg-gray-200 rounded animate-pulse" />
          ) : count === 0 ? (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          ) : (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${c.badge}`}>
              {count}
            </span>
          )}
        </div>
        <p className="text-xs font-semibold text-gray-800 leading-tight">{label}</p>
        <p className="text-xs text-gray-500 leading-tight">{sublabel}</p>
      </div>
    </Link>
  );
}

export function WorkflowStatusBanner() {
  const [data, setData] = useState<WorkflowData>({
    timePending:    { count: 0, loading: true },
    reportsUnsent:  { count: 0, loading: true },
    awaitingClient: { count: 0, loading: true },
    readyToInvoice: { count: 0, loading: true },
    arOverdue:      { count: 0, loading: true },
  });

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const since = fourteenDaysAgo.toISOString().split('T')[0];

    // Time entries pending approval (last 14 days)
    supabase
      .from('time_entries')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'pending')
      .gte('txn_date', since)
      .then(({ count }) =>
        setData(d => ({ ...d, timePending: { count: count ?? 0, loading: false } }))
      );

    // Reports not yet sent
    supabase
      .from('report_periods')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .then(({ count }) =>
        setData(d => ({ ...d, reportsUnsent: { count: count ?? 0, loading: false } }))
      );

    // Reports sent but not yet accepted by client
    supabase
      .from('report_periods')
      .select('id', { count: 'exact', head: true })
      .in('status', ['sent', 'supplemental_sent'])
      .then(({ count }) =>
        setData(d => ({ ...d, awaitingClient: { count: count ?? 0, loading: false } }))
      );

    // Accepted reports ready to invoice
    supabase
      .from('report_periods')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'accepted')
      .then(({ count }) =>
        setData(d => ({ ...d, readyToInvoice: { count: count ?? 0, loading: false } }))
      );

    // AR invoices overdue (next_action_date <= today, not paid/void/attorney)
    supabase
      .from('invoice_log')
      .select('id', { count: 'exact', head: true })
      .not('ar_status', 'in', '("paid","void","attorney")')
      .not('next_action_date', 'is', null)
      .lte('next_action_date', today)
      .then(({ count }) =>
        setData(d => ({ ...d, arOverdue: { count: count ?? 0, loading: false } }))
      );
  }, []);

  const allClear =
    !data.timePending.loading &&
    !data.reportsUnsent.loading &&
    !data.awaitingClient.loading &&
    !data.readyToInvoice.loading &&
    !data.arOverdue.loading &&
    data.timePending.count === 0 &&
    data.reportsUnsent.count === 0 &&
    data.readyToInvoice.count === 0 &&
    data.arOverdue.count === 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 text-gray-400" />
          Billing Pipeline
        </h2>
        {allClear && (
          <span className="text-xs text-green-600 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            All clear
          </span>
        )}
      </div>

      <div className="flex gap-2 items-stretch">
        <StageCell
          icon={Clock}
          label="Time Review"
          sublabel="Pending approval"
          count={data.timePending.count}
          loading={data.timePending.loading}
          href="/time-entries-enhanced"
          urgency={data.timePending.count > 5 ? 'warn' : data.timePending.count > 0 ? 'info' : 'none'}
        />

        <ChevronRight className="w-4 h-4 text-gray-300 self-center flex-shrink-0" />

        <StageCell
          icon={FileText}
          label="Reports"
          sublabel="Not yet sent"
          count={data.reportsUnsent.count}
          loading={data.reportsUnsent.loading}
          href="/reports"
          urgency={data.reportsUnsent.count > 0 ? 'warn' : 'none'}
        />

        <ChevronRight className="w-4 h-4 text-gray-300 self-center flex-shrink-0" />

        <StageCell
          icon={CheckSquare}
          label="Awaiting Client"
          sublabel="Sent, not confirmed"
          count={data.awaitingClient.count}
          loading={data.awaitingClient.loading}
          href="/reports"
          urgency={data.awaitingClient.count > 0 ? 'info' : 'none'}
        />

        <ChevronRight className="w-4 h-4 text-gray-300 self-center flex-shrink-0" />

        <StageCell
          icon={Receipt}
          label="Invoice Ready"
          sublabel="Accepted, not invoiced"
          count={data.readyToInvoice.count}
          loading={data.readyToInvoice.loading}
          href="/invoices"
          urgency={data.readyToInvoice.count > 0 ? 'warn' : 'none'}
        />

        <ChevronRight className="w-4 h-4 text-gray-300 self-center flex-shrink-0" />

        <StageCell
          icon={AlertCircle}
          label="Collections Due"
          sublabel="AR action needed"
          count={data.arOverdue.count}
          loading={data.arOverdue.loading}
          href="/ar"
          urgency={data.arOverdue.count > 2 ? 'urgent' : data.arOverdue.count > 0 ? 'warn' : 'none'}
        />
      </div>
    </div>
  );
}
