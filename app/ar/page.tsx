'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Receipt,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
  DollarSign,
  Send,
  FileText,
  Activity,
  Loader2,
  X,
  Phone,
  MessageSquare,
  CalendarCheck,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  Mail,
  ChevronRight,
  Ban,
  CircleDot,
  Scale,
  UserCheck,
} from 'lucide-react';
import { supabase, callEdgeFunction } from '@/lib/supabaseClient';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { format, differenceInDays, parseISO } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

type ARTab = 'dashboard' | 'invoices' | 'queue' | 'activity';
type ActionDialog = 'note' | 'call' | 'promise' | 'dispute' | 'resolve' | 'email' | null;

interface InvoiceLog {
  id: number;
  qb_invoice_id: string;
  qb_invoice_number: string;
  qb_customer_id: string;
  customer_name: string;
  billing_period_start: string;
  billing_period_end: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  due_date: string | null;
  ar_status: string;
  current_stage: number;
  next_action_date: string | null;
  billing_hold: boolean;
  promise_to_pay_date: string | null;
  attorney_referred_at: string | null;
  dispute_reason: string | null;
  created_at: string;
}

interface ARActivity {
  id: number;
  invoice_log_id: number;
  qb_invoice_id: string;
  qb_customer_id: string;
  activity_type: string;
  description: string;
  performed_by: string;
  performed_at: string;
  metadata: Record<string, any>;
}

interface AREmail {
  id: number;
  invoice_log_id: number;
  stage: number;
  stage_label: string;
  sent_at: string;
  sent_by: string;
  recipient_email: string;
  outcome: string;
  delivered_at: string | null;
  read_at: string | null;
  bounced_at: string | null;
  message_id: string | null;
}

interface ARPayment {
  id: number;
  invoice_log_id: number;
  payment_date: string;
  amount: number;
  method: string;
  notes: string | null;
}

interface InvoiceDetail {
  activities: ARActivity[];
  emails: AREmail[];
  payments: ARPayment[];
  customerEmail: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  unpaid: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  partial: 'bg-blue-100 text-blue-800 border-blue-200',
  paid: 'bg-green-100 text-green-800 border-green-200',
  disputed: 'bg-orange-100 text-orange-800 border-orange-200',
  on_hold: 'bg-gray-100 text-gray-700 border-gray-200',
  attorney: 'bg-red-100 text-red-800 border-red-200',
  void: 'bg-gray-100 text-gray-400 border-gray-200',
};

const activityIcons: Record<string, { icon: React.ElementType; color: string }> = {
  note: { icon: MessageSquare, color: 'text-gray-500 bg-gray-100' },
  call: { icon: Phone, color: 'text-blue-600 bg-blue-100' },
  email: { icon: Mail, color: 'text-indigo-600 bg-indigo-100' },
  payment: { icon: DollarSign, color: 'text-green-600 bg-green-100' },
  dispute: { icon: ShieldAlert, color: 'text-orange-600 bg-orange-100' },
  promise: { icon: CalendarCheck, color: 'text-teal-600 bg-teal-100' },
  hold: { icon: Ban, color: 'text-yellow-600 bg-yellow-100' },
  escalation: { icon: AlertTriangle, color: 'text-red-600 bg-red-100' },
  attorney: { icon: Scale, color: 'text-red-700 bg-red-100' },
};

const stageLabels: Record<number, string> = {
  0: 'Invoice Sent',
  1: 'First Notice',
  2: 'Grace Expired',
  3: 'Second Notice',
  4: 'Final Notice',
  5: 'Attorney Referral',
};

function fmt(n: number | null | undefined): string {
  if (n == null) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function agingInfo(dueDate: string | null): { days: number; label: string; color: string } {
  if (!dueDate) return { days: 0, label: '—', color: 'text-gray-400' };
  const days = differenceInDays(new Date(), parseISO(dueDate));
  if (days <= 0) return { days, label: 'Current', color: 'text-green-600' };
  if (days <= 15) return { days, label: `${days}d overdue`, color: 'text-yellow-600' };
  if (days <= 30) return { days, label: `${days}d overdue`, color: 'text-orange-600' };
  return { days, label: `${days}d overdue`, color: 'text-red-600 font-semibold' };
}

// ─── Invoice Detail Drawer ────────────────────────────────────────────────────

function InvoiceDrawer({
  invoice,
  detail,
  detailLoading,
  onAction,
  onClose,
}: {
  invoice: InvoiceLog;
  detail: InvoiceDetail | null;
  detailLoading: boolean;
  onAction: (action: ActionDialog) => void;
  onClose: () => void;
}) {
  const aging = agingInfo(invoice.due_date);
  const nextStage = (invoice.current_stage || 0) + 1;
  const canSendNext = !['paid', 'void', 'attorney'].includes(invoice.ar_status) && nextStage <= 4 && invoice.ar_status !== 'disputed';
  const hasEmail = !!detail?.customerEmail;

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-xl bg-white shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-600 to-rose-700 px-5 py-4 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">{invoice.customer_name}</h2>
              <p className="text-rose-100 text-sm mt-0.5">
                Invoice #{invoice.qb_invoice_number || invoice.qb_invoice_id}
                {invoice.billing_period_start && invoice.billing_period_end &&
                  ` · ${format(parseISO(invoice.billing_period_start), 'MMM d')}–${format(parseISO(invoice.billing_period_end), 'MMM d, yyyy')}`}
              </p>
            </div>
            <button onClick={onClose} className="text-white/80 hover:text-white p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusColors[invoice.ar_status] || statusColors.unpaid}`}>
              {invoice.ar_status}
            </span>
            <span className={`text-sm font-medium ${aging.color}`}>{aging.label}</span>
            {invoice.billing_hold && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
                <Ban className="w-3 h-3" /> On Hold
              </span>
            )}
          </div>
        </div>

        {/* Financials strip */}
        <div className="flex border-b border-gray-100 flex-shrink-0">
          <div className="flex-1 px-4 py-3 border-r border-gray-100">
            <p className="text-xs text-gray-500">Total Invoice</p>
            <p className="font-semibold text-gray-800">{fmt(invoice.total_amount)}</p>
          </div>
          <div className="flex-1 px-4 py-3 border-r border-gray-100">
            <p className="text-xs text-gray-500">Paid</p>
            <p className="font-semibold text-green-700">{fmt(invoice.amount_paid)}</p>
          </div>
          <div className="flex-1 px-4 py-3 border-r border-gray-100">
            <p className="text-xs text-gray-500">Balance Due</p>
            <p className="font-bold text-rose-700">{fmt(invoice.balance_due)}</p>
          </div>
          <div className="flex-1 px-4 py-3">
            <p className="text-xs text-gray-500">Stage</p>
            <p className="font-semibold text-gray-700 text-xs">{stageLabels[invoice.current_stage ?? 0]}</p>
          </div>
        </div>

        {/* Email warning */}
        {!detailLoading && !hasEmail && (
          <div className="mx-4 mt-3 flex-shrink-0 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>No email address on file — dunning emails cannot be sent.</span>
            <button
              onClick={() => onAction('email')}
              className="ml-auto text-xs font-medium text-amber-700 underline whitespace-nowrap"
            >
              Add Email
            </button>
          </div>
        )}

        {/* Promise-to-pay notice */}
        {invoice.promise_to_pay_date && (
          <div className="mx-4 mt-3 flex-shrink-0 p-3 bg-teal-50 border border-teal-200 rounded-lg flex items-center gap-2 text-sm text-teal-800">
            <CalendarCheck className="w-4 h-4 flex-shrink-0" />
            <span>Promised to pay by <strong>{format(parseISO(invoice.promise_to_pay_date), 'MMMM d, yyyy')}</strong></span>
          </div>
        )}

        {/* Dispute notice */}
        {invoice.ar_status === 'disputed' && invoice.dispute_reason && (
          <div className="mx-4 mt-3 flex-shrink-0 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
            <div className="flex items-center gap-1.5 font-medium mb-1"><ShieldAlert className="w-4 h-4" /> Disputed</div>
            <p className="text-xs">{invoice.dispute_reason}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onAction('call')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Phone className="w-3.5 h-3.5" /> Log Call
            </button>
            <button
              onClick={() => onAction('note')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" /> Add Note
            </button>
            <button
              onClick={() => onAction('promise')}
              disabled={!hasEmail}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <CalendarCheck className="w-3.5 h-3.5" /> Promise to Pay
            </button>
            {invoice.ar_status !== 'disputed' ? (
              <button
                onClick={() => onAction('dispute')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors"
              >
                <ShieldAlert className="w-3.5 h-3.5" /> Dispute
              </button>
            ) : (
              <button
                onClick={() => onAction('resolve')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Resolve Dispute
              </button>
            )}
            {invoice.billing_hold && (
              <button
                onClick={() => onAction('note')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors"
              >
                <Unlock className="w-3.5 h-3.5" /> Clear Hold
              </button>
            )}
            {canSendNext && (
              <button
                onClick={() => onAction(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors"
                data-send-stage
              >
                <Send className="w-3.5 h-3.5" /> Send Stage {nextStage}
              </button>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {detailLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
          ) : (
            <div className="space-y-1">
              {/* Combine emails + activities into a single sorted timeline */}
              {buildTimeline(detail, invoice).map((item, i) => (
                <TimelineItem key={i} item={item} />
              ))}
              {(!detail?.activities.length && !detail?.emails.length && !detail?.payments.length) && (
                <p className="text-center text-gray-400 text-sm py-6">No activity recorded yet.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface TimelineEntry {
  date: string;
  type: 'activity' | 'email' | 'payment';
  icon: React.ElementType;
  iconColor: string;
  title: string;
  body?: string;
  meta?: string;
  badges?: string[];
}

function buildTimeline(detail: InvoiceDetail | null, invoice: InvoiceLog): TimelineEntry[] {
  if (!detail) return [];
  const entries: TimelineEntry[] = [];

  // Invoice creation
  entries.push({
    date: invoice.created_at,
    type: 'activity',
    icon: FileText,
    iconColor: 'text-gray-500 bg-gray-100',
    title: 'Invoice Created',
    body: `Invoice #${invoice.qb_invoice_number || invoice.qb_invoice_id} · ${fmt(invoice.total_amount)}`,
    meta: invoice.due_date ? `Due ${format(parseISO(invoice.due_date), 'MMMM d, yyyy')}` : undefined,
  });

  for (const act of detail.activities) {
    const def = activityIcons[act.activity_type] || activityIcons.note;
    entries.push({
      date: act.performed_at,
      type: 'activity',
      icon: def.icon,
      iconColor: def.color,
      title: act.activity_type.charAt(0).toUpperCase() + act.activity_type.slice(1),
      body: act.description,
      meta: act.performed_by !== 'system' ? `by ${act.performed_by}` : undefined,
    });
  }

  for (const email of detail.emails) {
    const badges: string[] = [];
    if (email.delivered_at) badges.push('Delivered');
    if (email.read_at) badges.push('Read');
    if (email.bounced_at) badges.push('Bounced');
    if (!email.delivered_at && !email.bounced_at) badges.push('Sent');
    entries.push({
      date: email.sent_at,
      type: 'email',
      icon: Mail,
      iconColor: 'text-indigo-600 bg-indigo-100',
      title: email.stage_label,
      body: `To: ${email.recipient_email}`,
      meta: email.sent_by !== 'system' ? `by ${email.sent_by}` : undefined,
      badges,
    });
  }

  for (const pmt of detail.payments) {
    entries.push({
      date: pmt.payment_date + 'T00:00:00Z',
      type: 'payment',
      icon: DollarSign,
      iconColor: 'text-green-600 bg-green-100',
      title: `Payment Received`,
      body: `${fmt(pmt.amount)} via ${pmt.method.replace('_', ' ')}${pmt.notes ? ` — ${pmt.notes}` : ''}`,
    });
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

function TimelineItem({ item }: { item: TimelineEntry }) {
  const Icon = item.icon;
  const dateStr = (() => {
    try { return format(parseISO(item.date), 'MMM d, yyyy h:mm a'); } catch { return item.date; }
  })();

  return (
    <div className="flex gap-3 py-2.5">
      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${item.iconColor}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-800">{item.title}</span>
          {item.badges?.map(b => (
            <span key={b} className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${b === 'Read' ? 'bg-green-100 text-green-700' : b === 'Bounced' ? 'bg-red-100 text-red-700' : b === 'Delivered' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
              {b}
            </span>
          ))}
        </div>
        {item.body && <p className="text-xs text-gray-600 mt-0.5">{item.body}</p>}
        <p className="text-[11px] text-gray-400 mt-0.5">
          {dateStr}{item.meta ? ` · ${item.meta}` : ''}
        </p>
      </div>
    </div>
  );
}

// ─── Action Dialogs (shown inside drawer via portal/overlay) ─────────────────

function ActionDialogOverlay({
  title,
  onClose,
  onSubmit,
  submitting,
  children,
}: {
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">{children}</div>
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

function ARDashboard({ invoices, onSelectInvoice }: { invoices: InvoiceLog[]; onSelectInvoice: (inv: InvoiceLog) => void }) {
  const today = new Date();

  const buckets = {
    current: invoices.filter(i => !i.due_date || differenceInDays(today, parseISO(i.due_date)) <= 0),
    d1_15: invoices.filter(i => i.due_date && differenceInDays(today, parseISO(i.due_date)) > 0 && differenceInDays(today, parseISO(i.due_date)) <= 15),
    d16_30: invoices.filter(i => i.due_date && differenceInDays(today, parseISO(i.due_date)) > 15 && differenceInDays(today, parseISO(i.due_date)) <= 30),
    d31_45: invoices.filter(i => i.due_date && differenceInDays(today, parseISO(i.due_date)) > 30 && differenceInDays(today, parseISO(i.due_date)) <= 45),
    over45: invoices.filter(i => i.due_date && differenceInDays(today, parseISO(i.due_date)) > 45),
  };

  const totalAR = invoices.reduce((s, i) => s + (i.balance_due || 0), 0);
  const onHold = invoices.filter(i => i.billing_hold).length;
  const attorney = invoices.filter(i => i.ar_status === 'attorney').length;
  const disputed = invoices.filter(i => i.ar_status === 'disputed').length;
  const needsEmail = invoices.filter(i => !['paid', 'void'].includes(i.ar_status));

  const agingRows = [
    { label: 'Current', invoices: buckets.current, barColor: 'bg-green-400', rowColor: 'border-l-green-400' },
    { label: '1–15 days', invoices: buckets.d1_15, barColor: 'bg-yellow-400', rowColor: 'border-l-yellow-400' },
    { label: '16–30 days', invoices: buckets.d16_30, barColor: 'bg-orange-400', rowColor: 'border-l-orange-400' },
    { label: '31–45 days', invoices: buckets.d31_45, barColor: 'bg-red-400', rowColor: 'border-l-red-400' },
    { label: '45+ days', invoices: buckets.over45, barColor: 'bg-red-700', rowColor: 'border-l-red-700' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Outstanding', value: fmt(totalAR), sub: `${invoices.length} open`, color: 'text-gray-900' },
          { label: 'Billing Holds', value: onHold.toString(), sub: 'Projects paused', color: onHold > 0 ? 'text-orange-600' : 'text-gray-900' },
          { label: 'Disputed', value: disputed.toString(), sub: 'Pending resolution', color: disputed > 0 ? 'text-orange-600' : 'text-gray-900' },
          { label: '45+ Days Overdue', value: buckets.over45.length.toString(), sub: fmt(buckets.over45.reduce((s, i) => s + (i.balance_due || 0), 0)), color: buckets.over45.length > 0 ? 'text-red-600' : 'text-gray-900' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">{kpi.label}</p>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-gray-400 mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">AR Aging</h3>
        </div>
        {agingRows.map(row => {
          const total = row.invoices.reduce((s, i) => s + (i.balance_due || 0), 0);
          const pct = totalAR > 0 ? (total / totalAR) * 100 : 0;
          return (
            <div key={row.label} className={`flex items-center px-4 py-3 gap-4 border-l-4 ${row.rowColor}`}>
              <div className="w-24 text-sm font-medium text-gray-700">{row.label}</div>
              <div className="flex-1">
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className={`${row.barColor} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="text-sm text-gray-500 w-6 text-right">{row.invoices.length}</div>
              <div className="text-sm font-semibold text-gray-800 w-24 text-right">{fmt(total)}</div>
            </div>
          );
        })}
        <div className="px-4 py-3 border-t border-gray-200 flex justify-between bg-gray-50">
          <span className="text-sm font-semibold text-gray-700">Total Outstanding</span>
          <span className="text-sm font-bold text-gray-900">{fmt(totalAR)}</span>
        </div>
      </div>

      {/* Attorney + Disputed alerts */}
      {(attorney > 0 || disputed > 0) && (
        <div className="space-y-2">
          {attorney > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
              <Scale className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-red-800">{attorney} account{attorney > 1 ? 's' : ''} referred to attorney</p>
                <p className="text-sm text-red-600">Manual action required — contact legal counsel.</p>
              </div>
              <ChevronRight className="w-4 h-4 text-red-400" />
            </div>
          )}
          {disputed > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-orange-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-orange-800">{disputed} invoice{disputed > 1 ? 's' : ''} under dispute</p>
                <p className="text-sm text-orange-600">Review and resolve before resuming collections.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Invoices Tab ─────────────────────────────────────────────────────────────

function ARInvoices({
  invoices,
  customerEmails,
  onSelect,
}: {
  invoices: InvoiceLog[];
  customerEmails: Record<string, string | null>;
  onSelect: (inv: InvoiceLog) => void;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');

  const filtered = invoices.filter(inv => {
    const matchSearch = !search ||
      inv.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      inv.qb_invoice_number?.includes(search);
    const matchStatus = statusFilter === 'all'
      ? true
      : statusFilter === 'open'
      ? !['paid', 'void'].includes(inv.ar_status)
      : inv.ar_status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search customer or invoice #..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500"
        >
          <option value="open">Open</option>
          <option value="all">All</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partial</option>
          <option value="disputed">Disputed</option>
          <option value="attorney">Attorney</option>
          <option value="paid">Paid</option>
          <option value="void">Void</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Customer</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Period</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Balance</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Aging</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">No invoices found</td></tr>
              )}
              {filtered.map(inv => {
                const aging = agingInfo(inv.due_date);
                const noEmail = !customerEmails[inv.qb_customer_id];
                return (
                  <tr
                    key={inv.id}
                    onClick={() => onSelect(inv)}
                    className="hover:bg-rose-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 flex items-center gap-1.5">
                        {inv.customer_name}
                        {noEmail && !['paid', 'void'].includes(inv.ar_status) && (
                          <span title="No email on file" className="text-amber-500">
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                        <span>#{inv.qb_invoice_number || inv.qb_invoice_id}</span>
                        {inv.billing_hold && <span className="text-orange-500 font-medium flex items-center gap-0.5"><Ban className="w-2.5 h-2.5" /> Hold</span>}
                        {inv.promise_to_pay_date && <span className="text-teal-500 font-medium flex items-center gap-0.5"><CalendarCheck className="w-2.5 h-2.5" /> PTP</span>}
                        {inv.ar_status === 'disputed' && <span className="text-orange-500 font-medium flex items-center gap-0.5"><ShieldAlert className="w-2.5 h-2.5" /> Disputed</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 hidden sm:table-cell">
                      {inv.billing_period_start && inv.billing_period_end
                        ? `${format(parseISO(inv.billing_period_start), 'MMM d')} – ${format(parseISO(inv.billing_period_end), 'MMM d, yyyy')}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(inv.balance_due)}</td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      <span className={`text-xs font-medium ${aging.color}`}>{aging.label}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[inv.ar_status] || statusColors.unpaid}`}>
                        {inv.ar_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Collection Queue Tab ─────────────────────────────────────────────────────

function ARQueue({ invoices, onSelect }: { invoices: InvoiceLog[]; onSelect: (inv: InvoiceLog) => void }) {
  const today = new Date().toISOString().split('T')[0];

  const dueToday = invoices
    .filter(i => i.next_action_date && i.next_action_date <= today && !['paid', 'void'].includes(i.ar_status))
    .sort((a, b) => (a.next_action_date || '').localeCompare(b.next_action_date || ''));

  const upcoming = invoices
    .filter(i => i.next_action_date && i.next_action_date > today && !['paid', 'void'].includes(i.ar_status))
    .sort((a, b) => (a.next_action_date || '').localeCompare(b.next_action_date || ''))
    .slice(0, 15);

  const Section = ({ title, icon: Icon, iconColor, items, emptyMsg }: {
    title: string; icon: React.ElementType; iconColor: string; items: InvoiceLog[]; emptyMsg: string;
  }) => (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className={`px-4 py-3 border-b border-gray-100 flex items-center gap-2`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <h3 className="font-semibold text-gray-800">{title} ({items.length})</h3>
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-8 text-center text-gray-400">
          <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-300" />
          <p className="text-sm">{emptyMsg}</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {items.map(inv => {
            const nextStage = (inv.current_stage || 0) + 1;
            return (
              <div
                key={inv.id}
                onClick={() => onSelect(inv)}
                className="px-4 py-3 flex items-center gap-4 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{inv.customer_name}</p>
                  <p className="text-xs text-gray-500">
                    #{inv.qb_invoice_number} · Balance {fmt(inv.balance_due)}
                    {inv.promise_to_pay_date && <span className="ml-2 text-teal-600 font-medium">PTP {format(parseISO(inv.promise_to_pay_date), 'MMM d')}</span>}
                  </p>
                </div>
                <div className="text-xs text-gray-500 hidden sm:block">
                  {nextStage >= 5
                    ? <span className="text-red-600 font-semibold">Attorney Referral</span>
                    : <span>→ {stageLabels[nextStage]}</span>}
                </div>
                <span className={`text-xs font-medium whitespace-nowrap ${inv.next_action_date && inv.next_action_date <= today ? 'text-red-600' : 'text-blue-600'}`}>
                  {inv.next_action_date ? format(parseISO(inv.next_action_date), 'MMM d') : '—'}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <Section title="Action Required Today" icon={AlertTriangle} iconColor="text-red-500" items={dueToday} emptyMsg="No actions due today" />
      <Section title="Upcoming Actions" icon={Clock} iconColor="text-blue-500" items={upcoming} emptyMsg="No upcoming actions scheduled" />
    </div>
  );
}

// ─── Activity Log Tab ─────────────────────────────────────────────────────────

function ARActivityTab({ activities }: { activities: ARActivity[] }) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const filtered = activities.filter(a => {
    const matchSearch = !search ||
      a.description.toLowerCase().includes(search.toLowerCase()) ||
      a.qb_customer_id.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || a.activity_type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search activity..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2"
        >
          <option value="all">All Types</option>
          <option value="email">Emails</option>
          <option value="call">Calls</option>
          <option value="payment">Payments</option>
          <option value="promise">Promises</option>
          <option value="dispute">Disputes</option>
          <option value="escalation">Escalations</option>
          <option value="note">Notes</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
        {filtered.length === 0 && (
          <div className="py-8 text-center text-gray-400 text-sm">No activity found</div>
        )}
        {filtered.map(act => {
          const def = activityIcons[act.activity_type] || activityIcons.note;
          const Icon = def.icon;
          return (
            <div key={act.id} className="px-4 py-3 flex gap-3">
              <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${def.color}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800">{act.description}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {act.performed_by} · {format(parseISO(act.performed_at), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ARPage() {
  const [tab, setTab] = useState<ARTab>('dashboard');
  const [invoices, setInvoices] = useState<InvoiceLog[]>([]);
  const [activities, setActivities] = useState<ARActivity[]>([]);
  const [customerEmails, setCustomerEmails] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [fullSyncing, setFullSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Detail drawer
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceLog | null>(null);
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Action dialogs
  const [actionDialog, setActionDialog] = useState<ActionDialog>(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [formNote, setFormNote] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formAssignedTo, setFormAssignedTo] = useState('');
  const [formAssignedEmail, setFormAssignedEmail] = useState('');
  const [formResolution, setFormResolution] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [performedBy, setPerformedBy] = useState('Sharon');

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: invs, error: invErr }, { data: acts }, { data: custs }] = await Promise.all([
        supabase
          .from('invoice_log')
          .select('id, qb_invoice_id, qb_invoice_number, qb_customer_id, customer_name, billing_period_start, billing_period_end, total_amount, amount_paid, balance_due, due_date, ar_status, current_stage, next_action_date, billing_hold, promise_to_pay_date, attorney_referred_at, dispute_reason, created_at')
          .not('ar_status', 'is', null)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('ar_activity_log')
          .select('*')
          .order('performed_at', { ascending: false })
          .limit(200),
        supabase
          .from('customers')
          .select('qb_customer_id, email')
          .eq('is_active', true),
      ]);
      if (invErr) throw invErr;
      setInvoices(invs || []);
      setActivities(acts || []);
      const emailMap: Record<string, string | null> = {};
      for (const c of custs || []) emailMap[c.qb_customer_id] = c.email || null;
      setCustomerEmails(emailMap);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Load detail for selected invoice
  useEffect(() => {
    if (!selectedInvoice) { setDetail(null); return; }
    setDetailLoading(true);
    Promise.all([
      supabase.from('ar_activity_log').select('*').eq('invoice_log_id', selectedInvoice.id).order('performed_at', { ascending: false }),
      supabase.from('ar_collection_emails').select('*').eq('invoice_log_id', selectedInvoice.id).order('sent_at', { ascending: false }),
      supabase.from('ar_payments').select('*').eq('invoice_log_id', selectedInvoice.id).order('payment_date', { ascending: false }),
      supabase.from('customers').select('email').eq('qb_customer_id', selectedInvoice.qb_customer_id).single(),
    ]).then(([{ data: acts }, { data: emails }, { data: pmts }, { data: cust }]) => {
      setDetail({
        activities: acts || [],
        emails: emails || [],
        payments: pmts || [],
        customerEmail: cust?.email || null,
      });
    }).finally(() => setDetailLoading(false));
  }, [selectedInvoice]);

  const fullSyncFromQB = async () => {
    setFullSyncing(true);
    try {
      const res = await callEdgeFunction('ar-full-sync', {});
      if (res.success) {
        const msg = `QB sync complete — ${res.inserted || 0} new, ${res.updated || 0} updated`;
        showToast(msg, true);
        if (res.missingCustomers?.length) {
          console.warn('Customers not in our DB:', res.missingCustomers);
        }
        await load();
      } else {
        showToast(res.error || 'Full sync failed', false);
      }
    } catch (e: any) {
      showToast(e.message, false);
    } finally {
      setFullSyncing(false);
    }
  };

  const syncPayments = async () => {
    setSyncing(true);
    try {
      const res = await callEdgeFunction('ar-sync-payments', {});
      if (res.success) {
        showToast(`Sync complete — ${res.updated || 0} invoices updated`, true);
        await load();
      } else {
        showToast(res.error || 'Sync failed', false);
      }
    } catch (e: any) {
      showToast(e.message, false);
    } finally {
      setSyncing(false);
    }
  };

  const sendNextStage = async (inv: InvoiceLog) => {
    const stage = (inv.current_stage || 0) + 1;
    try {
      const res = await callEdgeFunction('ar-send-collection', { invoiceLogId: inv.id, stage, sentBy: performedBy });
      if (res.success) {
        showToast(`Stage ${stage} sent to ${inv.customer_name}`, true);
        await load();
        // Refresh detail
        if (selectedInvoice?.id === inv.id) setSelectedInvoice(s => s ? { ...s, current_stage: stage } : s);
      } else {
        showToast(res.error || 'Send failed', false);
      }
    } catch (e: any) {
      showToast(e.message, false);
    }
  };

  const submitAction = async () => {
    if (!selectedInvoice || !actionDialog) return;
    setActionSubmitting(true);
    try {
      let res;
      if (actionDialog === 'note') {
        res = await callEdgeFunction('ar-manage-invoice', { invoiceLogId: selectedInvoice.id, action: 'log_note', data: { text: formNote }, performedBy });
      } else if (actionDialog === 'call') {
        res = await callEdgeFunction('ar-manage-invoice', { invoiceLogId: selectedInvoice.id, action: 'log_call', data: { text: formNote, contactName: formContact }, performedBy });
      } else if (actionDialog === 'promise') {
        res = await callEdgeFunction('ar-manage-invoice', { invoiceLogId: selectedInvoice.id, action: 'promise_to_pay', data: { date: formDate, note: formNote }, performedBy });
      } else if (actionDialog === 'dispute') {
        res = await callEdgeFunction('ar-manage-invoice', { invoiceLogId: selectedInvoice.id, action: 'mark_disputed', data: { reason: formReason, assignedTo: formAssignedTo, assignedEmail: formAssignedEmail }, performedBy });
      } else if (actionDialog === 'resolve') {
        res = await callEdgeFunction('ar-manage-invoice', { invoiceLogId: selectedInvoice.id, action: 'resolve_dispute', data: { resolution: formResolution }, performedBy });
      } else if (actionDialog === 'email') {
        res = await callEdgeFunction('ar-manage-invoice', { invoiceLogId: selectedInvoice.id, action: 'update_customer_email', data: { email: formEmail }, performedBy });
      }

      if (res?.success) {
        showToast('Saved successfully', true);
        setActionDialog(null);
        resetForms();
        await load();
        // Refresh detail by re-triggering the detail load
        setDetail(null);
      } else {
        showToast(res?.error || 'Action failed', false);
      }
    } catch (e: any) {
      showToast(e.message, false);
    } finally {
      setActionSubmitting(false);
    }
  };

  const resetForms = () => {
    setFormNote(''); setFormContact(''); setFormDate('');
    setFormReason(''); setFormAssignedTo(''); setFormAssignedEmail('');
    setFormResolution(''); setFormEmail('');
  };

  const openInvoices = invoices.filter(i => !['paid', 'void'].includes(i.ar_status));
  const tabs: { id: ARTab; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: DollarSign },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'queue', label: 'Collection Queue', icon: AlertTriangle },
    { id: 'activity', label: 'Activity Log', icon: Activity },
  ];

  const handleDrawerAction = (action: ActionDialog) => {
    if (action === null && selectedInvoice) {
      sendNextStage(selectedInvoice);
      return;
    }
    resetForms();
    setActionDialog(action);
  };

  return (
    <AppShell>
      <PageHeader
        title="Accounts Receivable"
        subtitle="Invoice tracking, dunning sequence, and collections management"
        icon={<Receipt className="w-6 h-6 text-rose-600" />}
        actions={
          <div className="flex gap-2">
            <button
              onClick={fullSyncFromQB}
              disabled={fullSyncing || syncing}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50 transition-colors"
              title="Pull all open AR from QuickBooks — imports invoices not yet in this system"
            >
              {fullSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sync from QB
            </button>
            <button
              onClick={syncPayments}
              disabled={syncing || fullSyncing}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg disabled:opacity-50 transition-colors"
              title="Update payment balances from QuickBooks"
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
              Sync Payments
            </button>
          </div>
        }
      />

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${toast.ok ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.ok ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              tab === t.id ? 'border-rose-600 text-rose-700 bg-rose-50' : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 inline mr-2" />{error}
        </div>
      ) : (
        <>
          {tab === 'dashboard' && <ARDashboard invoices={openInvoices} onSelectInvoice={setSelectedInvoice} />}
          {tab === 'invoices' && <ARInvoices invoices={invoices} customerEmails={customerEmails} onSelect={inv => { setSelectedInvoice(inv); setTab('invoices'); }} />}
          {tab === 'queue' && <ARQueue invoices={openInvoices} onSelect={setSelectedInvoice} />}
          {tab === 'activity' && <ARActivityTab activities={activities} />}
        </>
      )}

      {/* Invoice Detail Drawer */}
      {selectedInvoice && (
        <InvoiceDrawer
          invoice={selectedInvoice}
          detail={detail}
          detailLoading={detailLoading}
          onAction={handleDrawerAction}
          onClose={() => { setSelectedInvoice(null); setDetail(null); setActionDialog(null); }}
        />
      )}

      {/* Action Dialogs */}
      {actionDialog === 'note' && selectedInvoice && (
        <ActionDialogOverlay title="Add Note" onClose={() => setActionDialog(null)} onSubmit={submitAction} submitting={actionSubmitting}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
            <textarea
              value={formNote}
              onChange={e => setFormNote(e.target.value)}
              rows={4}
              placeholder="Enter note..."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Logged by</label>
            <input value={performedBy} onChange={e => setPerformedBy(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500" />
          </div>
        </ActionDialogOverlay>
      )}

      {actionDialog === 'call' && selectedInvoice && (
        <ActionDialogOverlay title="Log Phone Call" onClose={() => setActionDialog(null)} onSubmit={submitAction} submitting={actionSubmitting}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact name (optional)</label>
            <input
              value={formContact}
              onChange={e => setFormContact(e.target.value)}
              placeholder="e.g. John Smith"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Call notes</label>
            <textarea
              value={formNote}
              onChange={e => setFormNote(e.target.value)}
              rows={4}
              placeholder="What was discussed? Any commitments made?"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Logged by</label>
            <input value={performedBy} onChange={e => setPerformedBy(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500" />
          </div>
        </ActionDialogOverlay>
      )}

      {actionDialog === 'promise' && selectedInvoice && (
        <ActionDialogOverlay title="Promise to Pay" onClose={() => setActionDialog(null)} onSubmit={submitAction} submitting={actionSubmitting}>
          <p className="text-sm text-gray-600">
            A confirmation email will be sent to the customer with the agreed payment date and a delivery + read receipt.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment commitment date <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={formDate}
              onChange={e => setFormDate(e.target.value)}
              min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Additional note for email (optional)</label>
            <textarea
              value={formNote}
              onChange={e => setFormNote(e.target.value)}
              rows={3}
              placeholder="Any special arrangements or payment instructions..."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recorded by</label>
            <input value={performedBy} onChange={e => setPerformedBy(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500" />
          </div>
        </ActionDialogOverlay>
      )}

      {actionDialog === 'dispute' && selectedInvoice && (
        <ActionDialogOverlay title="Mark as Disputed" onClose={() => setActionDialog(null)} onSubmit={submitAction} submitting={actionSubmitting}>
          <p className="text-sm text-gray-600">
            Dunning will pause. If you assign this to a team member, they will receive an email requesting documentation.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dispute reason <span className="text-red-500">*</span></label>
            <textarea
              value={formReason}
              onChange={e => setFormReason(e.target.value)}
              rows={3}
              placeholder="Describe what is being disputed and why..."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assign to (name, optional)</label>
            <input
              value={formAssignedTo}
              onChange={e => setFormAssignedTo(e.target.value)}
              placeholder="e.g. Mike Johnson"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assign to (email, optional — sends assignment email)</label>
            <input
              type="email"
              value={formAssignedEmail}
              onChange={e => setFormAssignedEmail(e.target.value)}
              placeholder="email@mitigationconsulting.com"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recorded by</label>
            <input value={performedBy} onChange={e => setPerformedBy(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500" />
          </div>
        </ActionDialogOverlay>
      )}

      {actionDialog === 'resolve' && selectedInvoice && (
        <ActionDialogOverlay title="Resolve Dispute" onClose={() => setActionDialog(null)} onSubmit={submitAction} submitting={actionSubmitting}>
          <p className="text-sm text-gray-600">Resolving will resume dunning at the current stage.</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Resolution notes</label>
            <textarea
              value={formResolution}
              onChange={e => setFormResolution(e.target.value)}
              rows={3}
              placeholder="How was this resolved? Any adjustments made?"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Resolved by</label>
            <input value={performedBy} onChange={e => setPerformedBy(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500" />
          </div>
        </ActionDialogOverlay>
      )}

      {actionDialog === 'email' && selectedInvoice && (
        <ActionDialogOverlay title="Add Customer Email" onClose={() => setActionDialog(null)} onSubmit={submitAction} submitting={actionSubmitting}>
          <p className="text-sm text-gray-600">
            This email will be saved to the customer record and used for all future dunning emails.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email address <span className="text-red-500">*</span></label>
            <input
              type="email"
              value={formEmail}
              onChange={e => setFormEmail(e.target.value)}
              placeholder="contact@customer.com"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
        </ActionDialogOverlay>
      )}
    </AppShell>
  );
}
