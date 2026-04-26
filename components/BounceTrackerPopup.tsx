'use client';

/**
 * BounceTrackerPopup — Sharon Pop-Up Bounce Tracker
 *
 * Reads invoice_bounce_alerts where status='open' and surfaces a
 * dismissable banner + expandable modal listing each bounce. Sharon
 * acknowledges / resolves each one inline. Re-polls every 60s so new
 * bounces from the cron appear without a page refresh.
 *
 * Origin: 2026-04-26. David's directive: "Whenever we have an invoice
 * payment email bounce that needs to go back to Sharon in the weekly
 * timesheet app, it needs to be a pop-up on her screen. It needs to be
 * tracked until she can confirm that it is gone and clear them. We
 * can't have people saying that they didn't get their documents."
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useMsal } from '@azure/msal-react';
import { AlertTriangle, CheckCircle2, X, ExternalLink, Mail, FileText, Share2, RotateCw } from 'lucide-react';
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
}

const CATEGORY_META: Record<BounceAlert['category'], { label: string; color: string; Icon: typeof Mail }> = {
  invoice: { label: 'Invoice', color: 'bg-red-100 text-red-800 border-red-300', Icon: FileText },
  document_share: { label: 'Document Share', color: 'bg-amber-100 text-amber-800 border-amber-300', Icon: Share2 },
  project_invite: { label: 'Project Invite', color: 'bg-blue-100 text-blue-800 border-blue-300', Icon: Mail },
  report_delivery: { label: 'Report', color: 'bg-purple-100 text-purple-800 border-purple-300', Icon: FileText },
  platform_notice: { label: 'Platform Notice', color: 'bg-slate-100 text-slate-700 border-slate-300', Icon: Mail },
  unknown: { label: 'Other', color: 'bg-slate-100 text-slate-700 border-slate-300', Icon: Mail },
};

const RESOLUTION_ACTIONS: Array<{ value: string; label: string }> = [
  { value: 'resent_to_correct_address', label: 'Resent to corrected address' },
  { value: 'corrected_customer_email', label: 'Updated customer email in QB' },
  { value: 'called_client', label: 'Called client directly' },
  { value: 'no_action_needed', label: 'No action needed' },
  { value: 'other', label: 'Other (see notes)' },
];

export function BounceTrackerPopup() {
  const { accounts } = useMsal();
  const userEmail = accounts?.[0]?.username ?? null;

  const [bounces, setBounces] = useState<BounceAlert[]>([]);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('invoice_bounce_alerts')
      .select('id, source_subject, source_mailbox, received_at, original_subject, bounced_recipient, bounce_reason, bounce_status_code, category, customer_id, qb_customer_id, invoice_number, raw_body_excerpt, status')
      .eq('status', 'open')
      .order('received_at', { ascending: false })
      .limit(100);
    if (error) {
      console.error('[BounceTracker] load failed:', error.message);
      return;
    }
    setBounces((data ?? []) as BounceAlert[]);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const acknowledge = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase
      .from('invoice_bounce_alerts')
      .update({
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: userEmail,
      })
      .eq('id', id);
    setBusyId(null);
    if (error) { toast.error('Acknowledge failed: ' + error.message); return; }
    toast.success('Acknowledged');
    await load();
  };

  const resolve = async (id: string, action: string, notes: string) => {
    if (!action) { toast.error('Pick a resolution action'); return; }
    setBusyId(id);
    const { error } = await supabase
      .from('invoice_bounce_alerts')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: userEmail,
        resolution_action: action,
        resolution_notes: notes || null,
        // Auto-acknowledge if not already
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: userEmail,
      })
      .eq('id', id);
    setBusyId(null);
    if (error) { toast.error('Resolve failed: ' + error.message); return; }
    toast.success('Resolved');
    setExpanded(null);
    await load();
  };

  if (bounces.length === 0) return null;

  // Compact banner — always visible at the top of the page when there's at least one open bounce.
  return (
    <>
      <div
        className="fixed top-20 right-4 z-50 cursor-pointer"
        title="Click to see every email that bounced and needs Sharon's follow-up"
        onClick={() => setOpen(true)}
      >
        <div className="bg-red-600 text-white px-4 py-3 rounded-lg shadow-2xl border-2 border-red-700 flex items-center gap-2 animate-pulse hover:animate-none">
          <AlertTriangle className="w-5 h-5" />
          <div>
            <div className="text-sm font-bold">{bounces.length} email bounce{bounces.length === 1 ? '' : 's'} need follow-up</div>
            <div className="text-xs opacity-90">Click to review &amp; clear</div>
          </div>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 flex items-start justify-center p-4 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full my-8" data-testid="bounce-tracker-modal">
            <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white px-6 py-4 rounded-t-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-6 h-6" />
                <div>
                  <h2 className="text-lg font-bold">Email Bounces — Action Needed</h2>
                  <p className="text-xs opacity-90">{bounces.length} client-facing email{bounces.length === 1 ? '' : 's'} did not deliver. Each must be cleared before this banner goes away.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => load()}
                  className="p-2 hover:bg-white/10 rounded"
                  title="Refresh — pull latest bounces from the database"
                ><RotateCw className="w-5 h-5" /></button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 hover:bg-white/10 rounded"
                  title="Close — banner will reappear if any are still open"
                ><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="p-4 space-y-2 max-h-[70vh] overflow-y-auto">
              {bounces.map(b => (
                <BounceRow
                  key={b.id}
                  bounce={b}
                  expanded={expanded === b.id}
                  onToggle={() => setExpanded(expanded === b.id ? null : b.id)}
                  onAcknowledge={() => acknowledge(b.id)}
                  onResolve={(action, notes) => resolve(b.id, action, notes)}
                  busy={busyId === b.id}
                />
              ))}
            </div>

            <div className="px-6 py-3 bg-slate-50 rounded-b-xl text-xs text-slate-500 border-t">
              Sharon Pop-Up Bounce Tracker · auto-refreshes every 60 seconds · {bounces.length} open
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function BounceRow({
  bounce,
  expanded,
  onToggle,
  onAcknowledge,
  onResolve,
  busy,
}: {
  bounce: BounceAlert;
  expanded: boolean;
  onToggle: () => void;
  onAcknowledge: () => void;
  onResolve: (action: string, notes: string) => void;
  busy: boolean;
}) {
  const [action, setAction] = useState('');
  const [notes, setNotes] = useState('');
  const meta = CATEGORY_META[bounce.category];
  const Icon = meta.Icon;

  return (
    <div className="border border-slate-200 rounded-lg bg-white" data-testid={`bounce-row-${bounce.id}`}>
      <div className="p-3 flex items-start gap-3">
        <div className={`px-2 py-1 rounded border text-xs font-bold flex items-center gap-1 ${meta.color}`} title={`Category: ${meta.label}`}>
          <Icon className="w-3 h-3" />
          {meta.label}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-800 truncate" title={bounce.original_subject ?? bounce.source_subject}>
            {bounce.original_subject ?? bounce.source_subject}
          </div>
          <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-x-4 gap-y-1">
            <span title="The address that bounced">📧 <code>{bounce.bounced_recipient ?? '?'}</code></span>
            {bounce.invoice_number && <span title="Invoice number extracted from the subject">🧾 #{bounce.invoice_number}</span>}
            {bounce.bounce_status_code && <span title="SMTP status code from the bounce">⚠ {bounce.bounce_status_code}</span>}
            <span title="When the bounce was received in our inbox">{new Date(bounce.received_at).toLocaleString()}</span>
          </div>
          {bounce.bounce_reason && (
            <div className="text-xs text-amber-700 mt-1" title="Plain-English reason extracted from the bounce body">
              {bounce.bounce_reason}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggle}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded hover:bg-slate-50"
            title="Expand to see the full bounce body and resolve this alert"
          >
            {expanded ? 'Collapse' : 'Resolve…'}
          </button>
          <button
            onClick={onAcknowledge}
            disabled={busy}
            className="px-3 py-1.5 text-xs border border-blue-300 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 disabled:opacity-50"
            title="Mark as seen — but it stays in the queue until resolved"
          >
            Ack
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-0 border-t border-slate-100 space-y-3">
          {bounce.raw_body_excerpt && (
            <details className="text-xs text-slate-600">
              <summary className="cursor-pointer hover:text-slate-900" title="Raw text from the NDR body">View bounce details</summary>
              <pre className="mt-2 p-2 bg-slate-50 rounded text-[11px] whitespace-pre-wrap max-h-40 overflow-y-auto">{bounce.raw_body_excerpt}</pre>
            </details>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate-600 font-medium" title="Pick what you did about this bounce">Action:</label>
            <select
              value={action}
              onChange={e => setAction(e.target.value)}
              className="text-xs border border-slate-300 rounded px-2 py-1"
              title="What you did to resolve this bounce — required"
            >
              <option value="">— pick one —</option>
              {RESOLUTION_ACTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="flex-1 text-xs border border-slate-300 rounded px-2 py-1 min-w-[200px]"
              title="Anything else worth recording"
            />
            <button
              onClick={() => onResolve(action, notes)}
              disabled={!action || busy}
              className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
              title="Mark this bounce resolved and remove from Sharon's queue"
            >
              <CheckCircle2 className="w-3 h-3" />
              Resolve
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
