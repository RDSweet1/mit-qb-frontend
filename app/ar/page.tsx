'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Receipt,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
  ChevronRight,
  DollarSign,
  Send,
  FileText,
  Activity,
  Loader2,
  Ban,
} from 'lucide-react';
import { supabase, callEdgeFunction } from '@/lib/supabaseClient';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { format, differenceInDays, parseISO } from 'date-fns';

type ARTab = 'dashboard' | 'invoices' | 'queue' | 'activity';

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
  created_at: string;
}

interface ARActivityLog {
  id: number;
  invoice_log_id: number;
  qb_customer_id: string;
  activity_type: string;
  description: string;
  performed_by: string;
  performed_at: string;
  metadata: Record<string, any>;
}

const statusColors: Record<string, string> = {
  unpaid: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  partial: 'bg-blue-100 text-blue-800 border-blue-200',
  paid: 'bg-green-100 text-green-800 border-green-200',
  disputed: 'bg-orange-100 text-orange-800 border-orange-200',
  on_hold: 'bg-gray-100 text-gray-800 border-gray-200',
  attorney: 'bg-red-100 text-red-800 border-red-200',
  void: 'bg-gray-100 text-gray-400 border-gray-200',
};

const stageLabels: Record<number, string> = {
  0: 'Invoice Sent',
  1: 'First Notice',
  2: 'Grace Expired',
  3: 'Second Notice',
  4: 'Final Notice',
  5: 'Attorney Referral',
};

function agingLabel(dueDate: string | null): { label: string; color: string } {
  if (!dueDate) return { label: '—', color: 'text-gray-400' };
  const days = differenceInDays(new Date(), parseISO(dueDate));
  if (days <= 0) return { label: 'Current', color: 'text-green-600' };
  if (days <= 15) return { label: `${days}d`, color: 'text-yellow-600' };
  if (days <= 30) return { label: `${days}d`, color: 'text-orange-600' };
  return { label: `${days}d`, color: 'text-red-600 font-semibold' };
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

function ARDashboard({ invoices }: { invoices: InvoiceLog[] }) {
  const today = new Date();

  const buckets = {
    current: invoices.filter(i => !i.due_date || differenceInDays(today, parseISO(i.due_date)) <= 0),
    days1_15: invoices.filter(i => i.due_date && differenceInDays(today, parseISO(i.due_date)) > 0 && differenceInDays(today, parseISO(i.due_date)) <= 15),
    days16_30: invoices.filter(i => i.due_date && differenceInDays(today, parseISO(i.due_date)) > 15 && differenceInDays(today, parseISO(i.due_date)) <= 30),
    days31_45: invoices.filter(i => i.due_date && differenceInDays(today, parseISO(i.due_date)) > 30 && differenceInDays(today, parseISO(i.due_date)) <= 45),
    over45: invoices.filter(i => i.due_date && differenceInDays(today, parseISO(i.due_date)) > 45),
  };

  const totalAR = invoices.reduce((s, i) => s + (i.balance_due || 0), 0);
  const onHold = invoices.filter(i => i.billing_hold).length;
  const attorney = invoices.filter(i => i.ar_status === 'attorney' || i.current_stage >= 5).length;

  const agingRows = [
    { label: 'Current', invoices: buckets.current, color: 'bg-green-50 border-green-200' },
    { label: '1–15 days', invoices: buckets.days1_15, color: 'bg-yellow-50 border-yellow-200' },
    { label: '16–30 days', invoices: buckets.days16_30, color: 'bg-orange-50 border-orange-200' },
    { label: '31–45 days', invoices: buckets.days31_45, color: 'bg-red-50 border-red-200' },
    { label: '45+ days', invoices: buckets.over45, color: 'bg-red-100 border-red-300' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Total AR Outstanding</p>
          <p className="text-2xl font-bold text-gray-900">{fmt(totalAR)}</p>
          <p className="text-xs text-gray-400 mt-1">{invoices.length} open invoice{invoices.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Billing Holds Active</p>
          <p className={`text-2xl font-bold ${onHold > 0 ? 'text-orange-600' : 'text-gray-900'}`}>{onHold}</p>
          <p className="text-xs text-gray-400 mt-1">Projects on hold</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Attorney Referrals</p>
          <p className={`text-2xl font-bold ${attorney > 0 ? 'text-red-600' : 'text-gray-900'}`}>{attorney}</p>
          <p className="text-xs text-gray-400 mt-1">Manual action required</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">45+ Days Overdue</p>
          <p className={`text-2xl font-bold ${buckets.over45.length > 0 ? 'text-red-700' : 'text-gray-900'}`}>{buckets.over45.length}</p>
          <p className="text-xs text-gray-400 mt-1">{fmt(buckets.over45.reduce((s, i) => s + (i.balance_due || 0), 0))}</p>
        </div>
      </div>

      {/* Aging buckets */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">AR Aging Summary</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {agingRows.map(row => {
            const total = row.invoices.reduce((s, i) => s + (i.balance_due || 0), 0);
            const pct = totalAR > 0 ? (total / totalAR) * 100 : 0;
            return (
              <div key={row.label} className={`flex items-center px-4 py-3 gap-4 ${row.color} border-l-4`}>
                <div className="w-24 text-sm font-medium text-gray-700">{row.label}</div>
                <div className="flex-1">
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="text-sm text-gray-500 w-8 text-right">{row.invoices.length}</div>
                <div className="text-sm font-semibold text-gray-800 w-24 text-right">{fmt(total)}</div>
              </div>
            );
          })}
        </div>
        <div className="px-4 py-3 border-t border-gray-200 flex justify-between items-center bg-gray-50">
          <span className="text-sm font-semibold text-gray-700">Total Outstanding</span>
          <span className="text-sm font-bold text-gray-900">{fmt(totalAR)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Invoices Tab ─────────────────────────────────────────────────────────────

function ARInvoices({ invoices, onSendStage }: { invoices: InvoiceLog[]; onSendStage: (inv: InvoiceLog, stage: number) => void }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [sending, setSending] = useState<number | null>(null);

  const filtered = invoices.filter(inv => {
    const matchSearch = !search || inv.customer_name?.toLowerCase().includes(search.toLowerCase()) || inv.qb_invoice_number?.includes(search);
    const matchStatus = statusFilter === 'all' || (statusFilter === 'open' ? !['paid', 'void'].includes(inv.ar_status) : inv.ar_status === statusFilter);
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search customer or invoice #..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="open">Open</option>
          <option value="all">All</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
          <option value="attorney">Attorney</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Customer</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Invoice #</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Period</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Balance</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Aging</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Stage</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-gray-400">No invoices found</td>
                </tr>
              )}
              {filtered.map(inv => {
                const aging = agingLabel(inv.due_date);
                const nextStage = (inv.current_stage || 0) + 1;
                const canSend = !['paid', 'void', 'attorney'].includes(inv.ar_status) && nextStage <= 4;
                return (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{inv.customer_name || '—'}</div>
                      {inv.billing_hold && (
                        <span className="text-xs text-orange-600 font-medium">Project on hold</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{inv.qb_invoice_number || inv.qb_invoice_id}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {inv.billing_period_start && inv.billing_period_end
                        ? `${format(parseISO(inv.billing_period_start), 'MMM d')} – ${format(parseISO(inv.billing_period_end), 'MMM d, yyyy')}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(inv.total_amount)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(inv.balance_due)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium ${aging.color}`}>{aging.label}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[inv.ar_status] || statusColors.unpaid}`}>
                        {inv.ar_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">
                      {stageLabels[inv.current_stage ?? 0] || `Stage ${inv.current_stage}`}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canSend && (
                        <button
                          onClick={() => onSendStage(inv, nextStage)}
                          disabled={sending === inv.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
                        >
                          {sending === inv.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Send className="w-3 h-3" />}
                          Stage {nextStage}
                        </button>
                      )}
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

function ARQueue({ invoices }: { invoices: InvoiceLog[] }) {
  const today = new Date().toISOString().split('T')[0];

  const dueToday = invoices.filter(inv =>
    inv.next_action_date && inv.next_action_date <= today &&
    !['paid', 'void'].includes(inv.ar_status)
  ).sort((a, b) => (a.next_action_date || '').localeCompare(b.next_action_date || ''));

  const upcoming = invoices.filter(inv =>
    inv.next_action_date && inv.next_action_date > today &&
    !['paid', 'void'].includes(inv.ar_status)
  ).sort((a, b) => (a.next_action_date || '').localeCompare(b.next_action_date || '')).slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Due today / overdue */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <h3 className="font-semibold text-gray-800">Action Required Today ({dueToday.length})</h3>
        </div>
        {dueToday.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-400">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
            <p>No actions due today</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {dueToday.map(inv => {
              const nextStage = (inv.current_stage || 0) + 1;
              return (
                <div key={inv.id} className="px-4 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{inv.customer_name}</p>
                    <p className="text-xs text-gray-500">Invoice {inv.qb_invoice_number} · Balance {fmt(inv.balance_due)}</p>
                  </div>
                  <div className="text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[inv.ar_status]}`}>
                      {inv.ar_status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {nextStage >= 5 ? (
                      <span className="text-red-600 font-semibold">Attorney Referral</span>
                    ) : (
                      <span>→ {stageLabels[nextStage]}</span>
                    )}
                  </div>
                  {inv.next_action_date && (
                    <div className="text-xs text-red-600 font-medium whitespace-nowrap">
                      Due {format(parseISO(inv.next_action_date), 'MMM d')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upcoming actions */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-500" />
          <h3 className="font-semibold text-gray-800">Upcoming Actions</h3>
        </div>
        {upcoming.length === 0 ? (
          <div className="px-4 py-6 text-center text-gray-400 text-sm">No upcoming actions scheduled</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {upcoming.map(inv => (
              <div key={inv.id} className="px-4 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{inv.customer_name}</p>
                  <p className="text-xs text-gray-500">Invoice {inv.qb_invoice_number} · Balance {fmt(inv.balance_due)}</p>
                </div>
                <div className="text-xs text-gray-500">
                  → {stageLabels[(inv.current_stage || 0) + 1] || 'Next Stage'}
                </div>
                <div className="text-xs text-blue-600 font-medium whitespace-nowrap">
                  {inv.next_action_date ? format(parseISO(inv.next_action_date), 'MMM d') : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Activity Log Tab ─────────────────────────────────────────────────────────

function ARActivityLog({ activities }: { activities: ARActivityLog[] }) {
  const typeColors: Record<string, string> = {
    note: 'bg-gray-100 text-gray-700',
    call: 'bg-blue-100 text-blue-700',
    email: 'bg-indigo-100 text-indigo-700',
    payment: 'bg-green-100 text-green-700',
    dispute: 'bg-orange-100 text-orange-700',
    promise: 'bg-teal-100 text-teal-700',
    hold: 'bg-yellow-100 text-yellow-700',
    escalation: 'bg-red-100 text-red-700',
    attorney: 'bg-red-200 text-red-900',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800">Recent AR Activity</h3>
      </div>
      {activities.length === 0 ? (
        <div className="px-4 py-8 text-center text-gray-400">No activity yet</div>
      ) : (
        <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
          {activities.map(act => (
            <div key={act.id} className="px-4 py-3 flex gap-3">
              <span className={`mt-0.5 px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap h-fit ${typeColors[act.activity_type] || 'bg-gray-100 text-gray-600'}`}>
                {act.activity_type}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800">{act.description}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {act.performed_by} · {format(parseISO(act.performed_at), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ARPage() {
  const [tab, setTab] = useState<ARTab>('dashboard');
  const [invoices, setInvoices] = useState<InvoiceLog[]>([]);
  const [activities, setActivities] = useState<ARActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sendingStage, setSendingStage] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: invs, error: invErr }, { data: acts, error: actErr }] = await Promise.all([
        supabase
          .from('invoice_log')
          .select('id, qb_invoice_id, qb_invoice_number, qb_customer_id, customer_name, billing_period_start, billing_period_end, total_amount, amount_paid, balance_due, due_date, ar_status, current_stage, next_action_date, billing_hold, promise_to_pay_date, attorney_referred_at, created_at')
          .not('ar_status', 'is', null)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('ar_activity_log')
          .select('*')
          .order('performed_at', { ascending: false })
          .limit(100),
      ]);

      if (invErr) throw invErr;
      if (actErr) throw actErr;
      setInvoices(invs || []);
      setActivities(acts || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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

  const sendStage = async (inv: InvoiceLog, stage: number) => {
    setSendingStage(inv.id);
    try {
      const res = await callEdgeFunction('ar-send-collection', {
        invoiceLogId: inv.id,
        stage,
        sentBy: 'manual',
      });
      if (res.success) {
        showToast(`Stage ${stage} sent to ${inv.customer_name}`, true);
        await load();
      } else {
        showToast(res.error || 'Send failed', false);
      }
    } catch (e: any) {
      showToast(e.message, false);
    } finally {
      setSendingStage(null);
    }
  };

  const openInvoices = invoices.filter(i => !['paid', 'void'].includes(i.ar_status));

  const tabs: { id: ARTab; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: DollarSign },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'queue', label: 'Collection Queue', icon: AlertTriangle },
    { id: 'activity', label: 'Activity Log', icon: Activity },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Accounts Receivable"
        subtitle="Invoice tracking, dunning sequence, and collections management"
        icon={<Receipt className="w-6 h-6 text-rose-600" />}
        actions={
          <button
            onClick={syncPayments}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sync Payments
          </button>
        }
      />

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${toast.ok ? 'bg-green-600' : 'bg-red-600'}`}>
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
              tab === t.id
                ? 'border-rose-600 text-rose-700 bg-rose-50'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
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
          <AlertTriangle className="w-4 h-4 inline mr-2" />
          {error}
        </div>
      ) : (
        <>
          {tab === 'dashboard' && <ARDashboard invoices={openInvoices} />}
          {tab === 'invoices' && <ARInvoices invoices={invoices} onSendStage={sendStage} />}
          {tab === 'queue' && <ARQueue invoices={openInvoices} />}
          {tab === 'activity' && <ARActivityLog activities={activities} />}
        </>
      )}
    </AppShell>
  );
}
