'use client';

/**
 * /bounces — Sharon's email bounce management screen.
 *
 * Lists every "Undeliverable:" NDR the platform has received and lets
 * Sharon resolve each one by:
 *   - Resending to a corrected address (calls resend-bounced-email
 *     edge function which fires the Graph send and marks resolved)
 *   - Updating the customer's email in the system (manual link to
 *     /customer-recipients) and marking resolved
 *   - Marking "called client / handled out of band"
 *   - Marking "no action needed"
 *
 * Origin: 2026-04-26. David's directive: "We needed a UI, I would
 * think, for a screen to send this back out and resolve these issues
 * when they exist."
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useMsal } from '@azure/msal-react';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { AlertTriangle, Mail, FileText, Share2, RefreshCw, ExternalLink, CheckCircle2, Phone, X, Send, History, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

interface BounceAlert {
  id: string;
  source_subject: string;
  source_mailbox: string;
  received_at: string;
  original_subject: string | null;
  bounced_recipient: string | null;
  bounce_reason: string | null;
  bounce_status_code: string | null;
  category: 'invoice' | 'document_share' | 'project_invite' | 'report_delivery' | 'platform_notice' | 'unknown';
  customer_id: number | null;
  qb_customer_id: string | null;
  invoice_number: string | null;
  raw_body_excerpt: string | null;
  status: 'open' | 'acknowledged' | 'resolved' | 'ignored';
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_action: string | null;
  resolution_notes: string | null;
}

const CATEGORY_META: Record<BounceAlert['category'], { label: string; color: string; Icon: typeof Mail }> = {
  invoice: { label: 'Invoice', color: 'bg-red-100 text-red-800 border-red-300', Icon: FileText },
  document_share: { label: 'Document Share', color: 'bg-amber-100 text-amber-800 border-amber-300', Icon: Share2 },
  project_invite: { label: 'Project Invite', color: 'bg-blue-100 text-blue-800 border-blue-300', Icon: Mail },
  report_delivery: { label: 'Report', color: 'bg-purple-100 text-purple-800 border-purple-300', Icon: FileText },
  platform_notice: { label: 'Platform Notice', color: 'bg-slate-100 text-slate-700 border-slate-300', Icon: Mail },
  unknown: { label: 'Other', color: 'bg-slate-100 text-slate-700 border-slate-300', Icon: Mail },
};

type ViewMode = 'open' | 'all' | 'resolved';

export default function BouncesPage() {
  const { accounts } = useMsal();
  const userEmail = accounts?.[0]?.username ?? null;
  const [view, setView] = useState<ViewMode>('open');
  const [bounces, setBounces] = useState<BounceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRow, setActiveRow] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('invoice_bounce_alerts').select('*').order('received_at', { ascending: false }).limit(500);
    if (view === 'open') query = query.eq('status', 'open');
    else if (view === 'resolved') query = query.eq('status', 'resolved');
    const { data, error } = await query;
    setLoading(false);
    if (error) { toast.error('Load failed: ' + error.message); return; }
    setBounces((data ?? []) as BounceAlert[]);
  }, [view]);

  useEffect(() => { load(); }, [load]);

  const updateRow = async (id: string, patch: Partial<BounceAlert>) => {
    const { error } = await supabase.from('invoice_bounce_alerts').update(patch).eq('id', id);
    if (error) { toast.error('Update failed: ' + error.message); return false; }
    return true;
  };

  const acknowledge = async (id: string) => {
    if (!await updateRow(id, { status: 'acknowledged', acknowledged_at: new Date().toISOString(), acknowledged_by: userEmail })) return;
    toast.success('Acknowledged');
    await load();
  };

  const resolveOutOfBand = async (id: string, action: string, notes: string) => {
    if (!await updateRow(id, {
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolved_by: userEmail,
      resolution_action: action,
      resolution_notes: notes || null,
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: userEmail,
    } as Partial<BounceAlert>)) return;
    toast.success('Resolved');
    setActiveRow(null);
    await load();
  };

  const counts = {
    open: bounces.filter(b => b.status === 'open').length,
    all: bounces.length,
    resolved: bounces.filter(b => b.status === 'resolved').length,
  };

  return (
    <AppShell>
      <PageHeader
        title="Email Bounces"
        subtitle="Every invoice / document / report email that did not deliver — clear each one by resending, updating the address, or noting that you handled it manually."
      />

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {(['open', 'all', 'resolved'] as ViewMode[]).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === v
                ? 'bg-red-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-red-300'
            }`}
            title={`Show ${v === 'open' ? 'only open bounces awaiting your action' : v === 'resolved' ? 'history of bounces you have already cleared' : 'every bounce regardless of status'}`}
            data-testid={`bounce-view-${v}`}
          >
            {v === 'open' && <Filter className="w-4 h-4 inline mr-1" />}
            {v === 'resolved' && <History className="w-4 h-4 inline mr-1" />}
            {v.charAt(0).toUpperCase() + v.slice(1)}
            {view === v && counts[v] > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">{counts[v]}</span>
            )}
          </button>
        ))}
        <button
          onClick={load}
          className="ml-auto px-4 py-2 rounded-lg text-sm bg-white border border-gray-200 hover:border-blue-300 flex items-center gap-1"
          title="Refresh — pull the latest bounces from the database"
          data-testid="bounce-refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading && <div className="text-center text-gray-500 py-8">Loading…</div>}

      {!loading && bounces.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-green-900 mb-1">All caught up!</h3>
          <p className="text-sm text-green-700">
            {view === 'open' ? 'Nothing in the open queue. Every email is delivering or has been resolved.' : 'No bounces match this filter.'}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {bounces.map(b => (
          <BounceCard
            key={b.id}
            bounce={b}
            isActive={activeRow === b.id}
            onActivate={() => setActiveRow(activeRow === b.id ? null : b.id)}
            onAcknowledge={() => acknowledge(b.id)}
            onResolveOutOfBand={(action, notes) => resolveOutOfBand(b.id, action, notes)}
            onResent={() => { setActiveRow(null); load(); }}
          />
        ))}
      </div>
    </AppShell>
  );
}

function BounceCard({
  bounce,
  isActive,
  onActivate,
  onAcknowledge,
  onResolveOutOfBand,
  onResent,
}: {
  bounce: BounceAlert;
  isActive: boolean;
  onActivate: () => void;
  onAcknowledge: () => void;
  onResolveOutOfBand: (action: string, notes: string) => void;
  onResent: () => void;
}) {
  const meta = CATEGORY_META[bounce.category];
  const Icon = meta.Icon;
  const isOpen = bounce.status === 'open';

  return (
    <div className={`bg-white rounded-lg border ${isOpen ? 'border-red-200 shadow-sm' : 'border-gray-200 opacity-75'}`} data-testid={`bounce-card-${bounce.id}`}>
      <div className="p-4 flex items-start gap-4">
        <div className={`px-2 py-1 rounded border text-xs font-bold flex items-center gap-1 ${meta.color}`} title={`Category: ${meta.label}`}>
          <Icon className="w-3 h-3" />
          {meta.label}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 truncate" title={bounce.original_subject ?? bounce.source_subject}>
            {bounce.original_subject ?? bounce.source_subject}
          </div>
          <div className="text-xs text-gray-600 mt-1 flex flex-wrap gap-x-4 gap-y-1">
            <span title="The address that bounced">
              📧 <code className="bg-gray-50 px-1 py-0.5 rounded">{bounce.bounced_recipient ?? 'unknown'}</code>
            </span>
            {bounce.invoice_number && <span title="Invoice number extracted from the email subject">🧾 #{bounce.invoice_number}</span>}
            {bounce.bounce_status_code && <span title="SMTP status code from the bounce">⚠ {bounce.bounce_status_code}</span>}
            <span title="When the bounce was received in our inbox">{new Date(bounce.received_at).toLocaleString()}</span>
            {bounce.qb_customer_id && (
              <span title="Customer name detected from the original subject">👤 {bounce.qb_customer_id}</span>
            )}
          </div>
          {bounce.bounce_reason && (
            <div className="text-xs text-amber-700 mt-1" title="Plain-English reason extracted from the bounce body">
              {bounce.bounce_reason}
            </div>
          )}
          {bounce.status === 'resolved' && bounce.resolution_notes && (
            <div className="text-xs text-green-700 mt-1" title="Resolution notes from when this was cleared">
              ✓ {bounce.resolution_action} {bounce.resolved_by && `· by ${bounce.resolved_by}`} {bounce.resolution_notes && `· ${bounce.resolution_notes}`}
            </div>
          )}
        </div>

        {isOpen && (
          <div className="flex flex-col gap-1 items-end">
            <button
              onClick={onActivate}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
              title="Open the resend / resolve panel for this bounce"
              data-testid={`bounce-actions-${bounce.id}`}
            >
              {isActive ? 'Cancel' : 'Resolve…'}
            </button>
            <button
              onClick={onAcknowledge}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50"
              title="Mark as seen — stays in the queue but you've seen it"
            >
              Mark seen
            </button>
          </div>
        )}
      </div>

      {isActive && isOpen && (
        <ResolvePanel
          bounce={bounce}
          onResolveOutOfBand={onResolveOutOfBand}
          onResent={onResent}
        />
      )}
    </div>
  );
}

function ResolvePanel({
  bounce,
  onResolveOutOfBand,
  onResent,
}: {
  bounce: BounceAlert;
  onResolveOutOfBand: (action: string, notes: string) => void;
  onResent: () => void;
}) {
  const [tab, setTab] = useState<'resend' | 'manual'>('resend');
  // Resend state
  const [toAddress, setToAddress] = useState('');
  const [subjectOverride, setSubjectOverride] = useState(bounce.original_subject ?? '');
  const [bodyOverride, setBodyOverride] = useState('');
  const [resending, setResending] = useState(false);
  // Manual-resolution state
  const [manualAction, setManualAction] = useState('');
  const [manualNotes, setManualNotes] = useState('');

  const submitResend = async () => {
    if (!toAddress.trim() || !toAddress.includes('@')) {
      toast.error('Enter a valid email address to resend to');
      return;
    }
    setResending(true);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
      const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
      const r = await fetch(`${supabaseUrl}/functions/v1/resend-bounced-email`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${supabaseAnon}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bounce_alert_id: bounce.id,
          to: toAddress.trim(),
          subject: subjectOverride.trim() || undefined,
          body: bodyOverride.trim() || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) {
        toast.error('Resend failed: ' + (j.error ?? r.statusText));
        return;
      }
      toast.success(`Resent to ${toAddress}`);
      onResent();
    } catch (e) {
      toast.error('Resend exception: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="border-t border-gray-100 px-4 py-4 bg-gray-50">
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setTab('resend')}
          className={`px-3 py-1.5 text-xs rounded ${tab === 'resend' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}
          title="Resend this email to a corrected address — sends from accounting@ via Outlook"
          data-testid="bounce-tab-resend"
        >
          <Send className="w-3 h-3 inline mr-1" />
          Resend to corrected address
        </button>
        <button
          onClick={() => setTab('manual')}
          className={`px-3 py-1.5 text-xs rounded ${tab === 'manual' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}
          title="Mark resolved without resending — e.g. you called the client or already updated the address in QB"
          data-testid="bounce-tab-manual"
        >
          <Phone className="w-3 h-3 inline mr-1" />
          I handled this manually
        </button>
      </div>

      {tab === 'resend' && (
        <div className="space-y-2">
          <div>
            <label className="text-xs font-medium text-gray-700" title="The corrected address you want this email to go to">
              Send to <span className="text-red-600">*</span>
            </label>
            <input
              type="email"
              value={toAddress}
              onChange={e => setToAddress(e.target.value)}
              placeholder="correct.address@client.com"
              className="w-full text-sm border border-gray-300 rounded px-3 py-2 mt-0.5"
              autoFocus
              data-testid="bounce-resend-to"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700" title="Subject of the resent email — defaults to the original">
              Subject
            </label>
            <input
              type="text"
              value={subjectOverride}
              onChange={e => setSubjectOverride(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded px-3 py-2 mt-0.5"
              data-testid="bounce-resend-subject"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700" title="Optional message body — leave blank to send a generic 'we tried to deliver this' note that includes the original subject and reference">
              Body (optional)
            </label>
            <textarea
              value={bodyOverride}
              onChange={e => setBodyOverride(e.target.value)}
              rows={4}
              placeholder="Leave blank for a generic 'we previously tried to deliver this' message referencing the original. Or write your own."
              className="w-full text-sm border border-gray-300 rounded px-3 py-2 mt-0.5"
              data-testid="bounce-resend-body"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={submitResend}
              disabled={resending || !toAddress.trim()}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
              title="Send the resend now via Outlook (accounting@) and mark this bounce resolved"
              data-testid="bounce-resend-submit"
            >
              <Send className="w-4 h-4" />
              {resending ? 'Sending…' : 'Send & Resolve'}
            </button>
          </div>
        </div>
      )}

      {tab === 'manual' && (
        <div className="space-y-2">
          <div>
            <label className="text-xs font-medium text-gray-700" title="What did you do about this bounce — required">
              How did you handle it? <span className="text-red-600">*</span>
            </label>
            <select
              value={manualAction}
              onChange={e => setManualAction(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded px-3 py-2 mt-0.5"
              data-testid="bounce-manual-action"
            >
              <option value="">— pick one —</option>
              <option value="corrected_customer_email">Updated customer email in QuickBooks / Customer Recipients</option>
              <option value="called_client">Called client directly</option>
              <option value="no_action_needed">No action needed (intentional / stale)</option>
              <option value="other">Other (explain in notes)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700">Notes (optional)</label>
            <input
              type="text"
              value={manualNotes}
              onChange={e => setManualNotes(e.target.value)}
              placeholder="Any details worth recording"
              className="w-full text-sm border border-gray-300 rounded px-3 py-2 mt-0.5"
              data-testid="bounce-manual-notes"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => onResolveOutOfBand(manualAction, manualNotes)}
              disabled={!manualAction}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
              title="Mark this bounce resolved without resending"
              data-testid="bounce-manual-submit"
            >
              <CheckCircle2 className="w-4 h-4" />
              Mark resolved
            </button>
          </div>
        </div>
      )}

      {bounce.raw_body_excerpt && (
        <details className="mt-3 text-xs text-gray-600">
          <summary className="cursor-pointer hover:text-gray-900">View original NDR body</summary>
          <pre className="mt-2 p-2 bg-white border border-gray-200 rounded text-[11px] whitespace-pre-wrap max-h-48 overflow-y-auto">{bounce.raw_body_excerpt}</pre>
        </details>
      )}
    </div>
  );
}
