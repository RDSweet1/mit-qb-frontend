'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase, callEdgeFunction } from '@/lib/supabaseClient';

// ─── Types ──────────────────────────────────────────────────────────
interface ReviewToken {
  id: number;
  report_period_id: number;
  token: string;
  created_at: string;
  expires_at: string | null;
  first_opened_at: string | null;
  last_opened_at: string | null;
  open_count: number;
  customer_action: string | null;
  customer_action_at: string | null;
  customer_notes: string | null;
}

interface ReportPeriod {
  id: number;
  customer_id: number;
  qb_customer_id: string;
  customer_name: string;
  week_start: string;
  week_end: string;
  status: string;
  total_hours: number;
  entry_count: number;
  report_number: string | null;
  sent_at: string | null;
  accepted_at: string | null;
}

interface TimeEntry {
  id: number;
  txn_date: string;
  employee_name: string;
  cost_code: string | null;
  description: string | null;
  hours: number;
  minutes: number;
  billable_status: string;
}

interface Customer {
  id: number;
  qb_customer_id: string;
  display_name: string;
}

type PageState = 'loading' | 'not_found' | 'expired' | 'already_actioned' | 'review' | 'submitted' | 'error';

interface EntryFlag {
  entryId: number;
  note: string;
}

// ─── Colors (matching shared email templates) ───────────────────────
const COLORS = {
  blue: '#2563eb',
  blueDark: '#1e40af',
  green: '#16a34a',
  greenDark: '#166534',
  greenBg: '#f0fdf4',
  amber: '#fbbf24',
  amberDark: '#92400e',
  amberBg: '#fefce8',
  red: '#dc2626',
  gray: '#6b7280',
  grayLight: '#f9fafb',
  grayBorder: '#e5e7eb',
};

const SERVICE_COLORS: Record<string, { bg: string; text: string }> = {
  'Expert Analysis': { bg: '#ede9fe', text: '#5b21b6' },
  'Site Inspection': { bg: '#dbeafe', text: '#1e40af' },
  'Travel': { bg: '#fef3c7', text: '#92400e' },
  'Report Writing': { bg: '#fce7f3', text: '#9d174d' },
  'Consultation': { bg: '#d1fae5', text: '#065f46' },
  'Project Management': { bg: '#e0e7ff', text: '#3730a3' },
  'Administrative': { bg: '#f3f4f6', text: '#374151' },
};

// ─── Helper: format date ────────────────────────────────────────────
function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.toLocaleDateString('en-US', { weekday: 'short' });
  return `${day} ${d.getMonth() + 1}/${d.getDate()}`;
}

function businessDaysRemaining(expiresAt: string | null): number {
  if (!expiresAt) return 0;
  const now = new Date();
  const expiry = new Date(expiresAt);
  if (expiry <= now) return 0;
  let count = 0;
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  while (d < expiry) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

// ─── MIT logo base64 (same as email templates) ─────────────────────
const MIT_LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAhklEQVR42u2WSw6AMAhE5zKezON7iLpyU+OAfCZGJd1BeC2UD5Z1az34AbWAcUglYFiSAhBHTgby0eCWKIk1sWeAQP5dAO6dq85a3L27qZ0MXglIVjIDmOn1FNekjQOuekYZIPKC9hzEarj4mz4ekGG4epGimyrmQftEU8xk0Vah2Is+v5vuGba66UdGBNoAAAAASUVORK5CYII=';

// ─── Main Component ─────────────────────────────────────────────────
export default function ReviewPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [pageState, setPageState] = useState<PageState>('loading');
  const [reviewToken, setReviewToken] = useState<ReviewToken | null>(null);
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [customerNotes, setCustomerNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedAction, setSubmittedAction] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [flaggedEntries, setFlaggedEntries] = useState<Map<number, string>>(new Map());
  const [reassignedEntries, setReassignedEntries] = useState<Map<number, string>>(new Map());
  const [customers, setCustomers] = useState<Customer[]>([]);
  const visitLogged = useRef(false);

  function toggleFlag(entryId: number) {
    setFlaggedEntries(prev => {
      const next = new Map(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.set(entryId, '');
      }
      return next;
    });
  }

  function setFlagNote(entryId: number, note: string) {
    setFlaggedEntries(prev => {
      const next = new Map(prev);
      next.set(entryId, note);
      return next;
    });
  }

  function reassignEntry(entryId: number, customerName: string | null) {
    setReassignedEntries(prev => {
      const next = new Map(prev);
      if (customerName) {
        next.set(entryId, customerName);
      } else {
        next.delete(entryId);
      }
      return next;
    });
  }

  // Load data on mount
  const loadData = useCallback(async () => {
    if (!token) {
      setPageState('not_found');
      return;
    }

    try {
      // 1. Fetch review token
      const { data: tokenData, error: tokenErr } = await supabase
        .from('review_tokens')
        .select('*')
        .eq('token', token)
        .single();

      if (tokenErr || !tokenData) {
        setPageState('not_found');
        return;
      }

      setReviewToken(tokenData);

      // 2. Check if already actioned
      if (tokenData.customer_action) {
        setSubmittedAction(tokenData.customer_action);
        setCustomerNotes(tokenData.customer_notes || '');
      }

      // 3. Fetch report period
      const { data: rpData, error: rpErr } = await supabase
        .from('report_periods')
        .select('*')
        .eq('id', tokenData.report_period_id)
        .single();

      if (rpErr || !rpData) {
        setPageState('not_found');
        return;
      }

      setReportPeriod(rpData);

      // 4. Fetch time entries for this customer + week
      const { data: entryData } = await supabase
        .from('time_entries')
        .select('id, txn_date, employee_name, cost_code, description, hours, minutes, billable_status')
        .eq('qb_customer_id', rpData.qb_customer_id)
        .gte('txn_date', rpData.week_start)
        .lte('txn_date', rpData.week_end)
        .eq('billable_status', 'Billable')
        .order('txn_date', { ascending: true });

      setEntries(entryData || []);

      // 4b. Fetch customer list for reassignment dropdown
      const { data: customerData } = await supabase
        .from('customers')
        .select('id, qb_customer_id, display_name')
        .order('display_name', { ascending: true });

      setCustomers(customerData || []);

      // 5. Log visit (once)
      if (!visitLogged.current) {
        visitLogged.current = true;
        const updates: Record<string, any> = {
          last_opened_at: new Date().toISOString(),
          open_count: (tokenData.open_count || 0) + 1,
        };
        if (!tokenData.first_opened_at) {
          updates.first_opened_at = new Date().toISOString();
        }
        await supabase
          .from('review_tokens')
          .update(updates)
          .eq('id', tokenData.id);
      }

      // 6. Determine page state
      if (tokenData.customer_action) {
        setPageState('already_actioned');
      } else if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
        setPageState('expired');
      } else {
        setPageState('review');
      }
    } catch (err: any) {
      console.error('Error loading review data:', err);
      setErrorMsg(err.message || 'Failed to load review data');
      setPageState('error');
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Build combined notes (global + per-entry flags) ────────────
  function buildCombinedNotes(): string {
    const parts: string[] = [];
    if (customerNotes.trim()) {
      parts.push(`General Comments:\n${customerNotes.trim()}`);
    }
    if (reassignedEntries.size > 0) {
      parts.push('Reassigned Entries:');
      for (const [entryId, newProject] of reassignedEntries) {
        const entry = entries.find(e => e.id === entryId);
        const label = entry
          ? `${fmtShortDate(entry.txn_date)} — ${entry.employee_name} — ${(entry.hours + entry.minutes / 60).toFixed(2)} hrs`
          : `Entry #${entryId}`;
        parts.push(`  → ${label}\n    Reassign to: "${newProject}"`);
      }
    }
    if (flaggedEntries.size > 0) {
      parts.push('Flagged Entries:');
      for (const [entryId, note] of flaggedEntries) {
        const entry = entries.find(e => e.id === entryId);
        const label = entry
          ? `${fmtShortDate(entry.txn_date)} — ${entry.employee_name} — ${(entry.hours + entry.minutes / 60).toFixed(2)} hrs`
          : `Entry #${entryId}`;
        parts.push(`  • ${label}${note ? `\n    "${note}"` : ''}`);
      }
    }
    return parts.join('\n');
  }

  // ─── Handle Accept ──────────────────────────────────────────────
  async function handleAccept() {
    if (!reviewToken || !reportPeriod || submitting) return;
    setSubmitting(true);

    try {
      const notes = buildCombinedNotes();
      await callEdgeFunction('customer-review-action', {
        token: reviewToken.token,
        action: 'accepted',
        notes: notes || undefined,
      });

      setSubmittedAction('accepted');
      setPageState('submitted');
    } catch (err: any) {
      alert('Error submitting acceptance: ' + (err.message || 'Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Handle Submit Comments ─────────────────────────────────────
  async function handleSubmitComments() {
    if (!reviewToken || !reportPeriod || submitting) return;
    const notes = buildCombinedNotes();
    if (!notes.trim()) {
      alert('Please flag at least one entry, reassign an entry, or enter general comments before submitting.');
      return;
    }
    setSubmitting(true);

    try {
      await callEdgeFunction('customer-review-action', {
        token: reviewToken.token,
        action: 'disputed',
        notes,
      });

      setSubmittedAction('disputed');
      setPageState('submitted');
    } catch (err: any) {
      alert('Error submitting comments: ' + (err.message || 'Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Calculate totals ────────────────────────────────────────────
  const totalHours = entries.reduce((sum, e) => sum + e.hours + (e.minutes / 60), 0);
  const uniqueDays = new Set(entries.map(e => e.txn_date)).size;

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', fontFamily: 'Arial, sans-serif' }}>
      <style>{`
        @media (max-width: 768px) {
          .review-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .review-table-wrap table { min-width: 700px; }
          .review-sticky-bar .bar-inner { flex-wrap: wrap; }
          .review-sticky-bar .bar-stats { width: 100%; margin-bottom: 4px; }
        }
      `}</style>
      {/* Header */}
      <div style={{ backgroundColor: COLORS.blue, padding: '24px 0' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src={MIT_LOGO} width={32} height={32} alt="MIT" style={{ borderRadius: 4 }} />
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 'bold', color: '#fff' }}>
              Weekly Time &amp; Activity Report
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: '#dbeafe' }}>
              Mitigation Inspection &amp; Testing — MIT Consulting
            </p>
          </div>
        </div>
      </div>

      {/* Period banner */}
      {reportPeriod && (
        <div style={{ backgroundColor: COLORS.blueDark, padding: '12px 0' }}>
          <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#fff', fontSize: 14 }}>
              <strong>Report Period:</strong> {fmtDate(reportPeriod.week_start)} – {fmtDate(reportPeriod.week_end)}
            </span>
            {reportPeriod.report_number && (
              <span style={{ color: '#dbeafe', fontSize: 13 }}>{reportPeriod.report_number}</span>
            )}
          </div>
        </div>
      )}

      {/* Main content */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 24px 48px' }}>
        {/* ─── Loading ─────────────────────────── */}
        {pageState === 'loading' && (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <div style={{
              width: 40, height: 40, border: `4px solid ${COLORS.grayBorder}`,
              borderTopColor: COLORS.blue, borderRadius: '50%',
              animation: 'spin 1s linear infinite', margin: '0 auto 16px',
            }} />
            <p style={{ color: COLORS.gray }}>Loading report...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* ─── Not Found ──────────────────────── */}
        {pageState === 'not_found' && (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#128275;</div>
            <h2 style={{ margin: '0 0 8px', color: '#111' }}>Report Not Found</h2>
            <p style={{ color: COLORS.gray, maxWidth: 400, margin: '0 auto' }}>
              This review link is not valid. Please check the link in your email or contact
              us at <a href="mailto:accounting@mitigationconsulting.com" style={{ color: COLORS.blue }}>accounting@mitigationconsulting.com</a>.
            </p>
          </div>
        )}

        {/* ─── Error ──────────────────────────── */}
        {pageState === 'error' && (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#9888;&#65039;</div>
            <h2 style={{ margin: '0 0 8px', color: COLORS.red }}>Something Went Wrong</h2>
            <p style={{ color: COLORS.gray }}>{errorMsg || 'Please try again later.'}</p>
          </div>
        )}

        {/* ─── Expired ────────────────────────── */}
        {pageState === 'expired' && reportPeriod && (
          <>
            <StatusBanner
              color={COLORS.amber}
              bgColor={COLORS.amberBg}
              title="Review Period Has Ended"
              message={`The review window for the week of ${fmtDate(reportPeriod.week_start)} – ${fmtDate(reportPeriod.week_end)} has closed. These time entries have been confirmed as accurate. If you have concerns, please contact us directly.`}
            />
            <ReportContent entries={entries} totalHours={totalHours} uniqueDays={uniqueDays} reportPeriod={reportPeriod} readOnly />
          </>
        )}

        {/* ─── Already Actioned ───────────────── */}
        {pageState === 'already_actioned' && reportPeriod && reviewToken && (
          <>
            <StatusBanner
              color={submittedAction === 'accepted' ? COLORS.green : COLORS.blue}
              bgColor={submittedAction === 'accepted' ? COLORS.greenBg : '#eff6ff'}
              title={submittedAction === 'accepted'
                ? 'Time Entries Accepted'
                : 'Your Comments Were Submitted'}
              message={submittedAction === 'accepted'
                ? `You confirmed these time entries as accurate on ${new Date(reviewToken.customer_action_at!).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}. No further action is required.`
                : `Your comments were submitted on ${new Date(reviewToken.customer_action_at!).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}. Our team will review and follow up with you directly.`}
            />
            {reviewToken.customer_notes && (
              <div style={{
                backgroundColor: '#fff', border: `1px solid ${COLORS.grayBorder}`, borderRadius: 8,
                padding: 20, marginBottom: 20,
              }}>
                <h3 style={{ margin: '0 0 8px', fontSize: 14, color: COLORS.gray }}>Your Comments</h3>
                <p style={{ margin: 0, color: '#333', whiteSpace: 'pre-wrap' }}>{reviewToken.customer_notes}</p>
              </div>
            )}
            <ReportContent entries={entries} totalHours={totalHours} uniqueDays={uniqueDays} reportPeriod={reportPeriod} readOnly />
          </>
        )}

        {/* ─── Submitted (just now) ───────────── */}
        {pageState === 'submitted' && reportPeriod && (
          <>
            <div style={{
              backgroundColor: COLORS.greenBg, border: `2px solid ${COLORS.green}`, borderRadius: 12,
              padding: 32, textAlign: 'center', marginBottom: 24,
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>&#10003;</div>
              <h2 style={{ margin: '0 0 8px', color: COLORS.greenDark, fontSize: 20 }}>
                {submittedAction === 'accepted' ? 'Thank You — Time Entries Accepted' : 'Thank You — Comments Submitted'}
              </h2>
              <p style={{ margin: 0, color: COLORS.greenDark, fontSize: 14, maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' }}>
                {submittedAction === 'accepted'
                  ? 'Your response has been recorded. These hours will be included on your next billing statement. A confirmation email has been sent to you.'
                  : 'Your comments have been submitted. Our team will review them and follow up with you directly. A confirmation email has been sent to you.'}
              </p>
            </div>
            <ReportContent entries={entries} totalHours={totalHours} uniqueDays={uniqueDays} reportPeriod={reportPeriod} readOnly />
          </>
        )}

        {/* ─── Review (active) ────────────────── */}
        {pageState === 'review' && reportPeriod && reviewToken && (
          <>
            {/* Review notice */}
            <div style={{
              backgroundColor: COLORS.amberBg, border: `2px solid ${COLORS.amber}`, borderRadius: 12,
              padding: 20, marginBottom: 24,
            }}>
              <h3 style={{ margin: '0 0 8px', color: COLORS.amberDark, fontSize: 15 }}>
                &#9888; Please Review — {businessDaysRemaining(reviewToken.expires_at)} Business Day{businessDaysRemaining(reviewToken.expires_at) !== 1 ? 's' : ''} Remaining
              </h3>
              <p style={{ margin: 0, color: '#78350f', fontSize: 13, lineHeight: 1.7 }}>
                We kindly request that you review the time entries and detailed notes below and indicate any concerns you may have.
                If we do not receive a response within <strong>three (3) business days</strong>, the time will be accepted as reported and confirmed as billable.
              </p>
            </div>

            {/* Customer name card */}
            <div style={{
              backgroundColor: '#fff', border: `1px solid ${COLORS.grayBorder}`, borderRadius: 8,
              padding: 20, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, color: COLORS.gray }}>Prepared for:</p>
                <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 'bold', color: '#111' }}>{reportPeriod.customer_name}</p>
              </div>
              {reportPeriod.sent_at && (
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: 13, color: COLORS.gray }}>Report Sent:</p>
                  <p style={{ margin: '4px 0 0', fontSize: 14, color: '#111' }}>
                    {new Date(reportPeriod.sent_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              )}
            </div>

            {/* Report content with per-row flagging */}
            <ReportContent
              entries={entries}
              totalHours={totalHours}
              uniqueDays={uniqueDays}
              reportPeriod={reportPeriod}
              flaggedEntries={flaggedEntries}
              onToggleFlag={toggleFlag}
              onSetFlagNote={setFlagNote}
              reassignedEntries={reassignedEntries}
              onReassign={reassignEntry}
              customers={customers}
            />

            {/* General comments area */}
            <div style={{
              backgroundColor: '#fff', border: `1px solid ${COLORS.grayBorder}`, borderRadius: 12,
              padding: 28, marginTop: 24, marginBottom: 100,
            }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#111' }}>Additional Comments</h3>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: COLORS.gray }}>
                Use the flag buttons on individual entries above to identify specific concerns,
                or add general comments below.
              </p>
              <textarea
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="Any additional notes, clarifications, or general concerns..."
                style={{
                  width: '100%', minHeight: 80, padding: 12, border: `1px solid ${COLORS.grayBorder}`,
                  borderRadius: 8, fontSize: 14, fontFamily: 'Arial, sans-serif', resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
              {flaggedEntries.size > 0 && (
                <div style={{
                  marginTop: 12, padding: 12, backgroundColor: '#fef2f2', border: '1px solid #fecaca',
                  borderRadius: 8, fontSize: 13, color: '#991b1b',
                }}>
                  {flaggedEntries.size} {flaggedEntries.size === 1 ? 'entry' : 'entries'} flagged for review
                </div>
              )}
            </div>

            {/* Sticky bottom action bar */}
            {(() => {
              const hasChanges = flaggedEntries.size > 0 || reassignedEntries.size > 0;
              const changeCount = flaggedEntries.size + reassignedEntries.size;
              return (
                <div style={{
                  position: 'fixed', bottom: 0, left: 0, right: 0,
                  backgroundColor: hasChanges ? '#fef2f2' : '#fff',
                  borderTop: `2px solid ${hasChanges ? '#fca5a5' : '#e5e7eb'}`,
                  padding: '12px 24px',
                  boxShadow: '0 -4px 12px rgba(0,0,0,0.1)',
                  zIndex: 50,
                  transition: 'background-color 0.3s, border-color 0.3s',
                }}>
                  <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ flex: 1, fontSize: 13, color: COLORS.gray }}>
                      <strong>{entries.length}</strong> entries &middot; <strong>{totalHours.toFixed(2)}</strong> hrs
                      {flaggedEntries.size > 0 && (
                        <span style={{ color: COLORS.red, fontWeight: 'bold', marginLeft: 8 }}>
                          &middot; {flaggedEntries.size} flagged
                        </span>
                      )}
                      {reassignedEntries.size > 0 && (
                        <span style={{ color: '#7c3aed', fontWeight: 'bold', marginLeft: 8 }}>
                          &middot; {reassignedEntries.size} reassigned
                        </span>
                      )}
                    </div>
                    {!hasChanges ? (
                      <button
                        onClick={handleAccept}
                        disabled={submitting}
                        style={{
                          padding: '12px 28px',
                          backgroundColor: submitting ? '#9ca3af' : COLORS.green,
                          color: '#fff', border: 'none', borderRadius: 8,
                          fontSize: 14, fontWeight: 'bold', cursor: submitting ? 'not-allowed' : 'pointer',
                          transition: 'background-color 0.2s',
                          whiteSpace: 'nowrap',
                        }}
                        onMouseOver={(e) => { if (!submitting) e.currentTarget.style.backgroundColor = COLORS.greenDark; }}
                        onMouseOut={(e) => { if (!submitting) e.currentTarget.style.backgroundColor = COLORS.green; }}
                      >
                        {submitting ? 'Submitting...' : '\u2713  Accept All as Accurate'}
                      </button>
                    ) : (
                      <button
                        onClick={handleSubmitComments}
                        disabled={submitting}
                        style={{
                          padding: '12px 28px',
                          backgroundColor: submitting ? '#9ca3af' : COLORS.red,
                          color: '#fff', border: 'none', borderRadius: 8,
                          fontSize: 14, fontWeight: 'bold', cursor: submitting ? 'not-allowed' : 'pointer',
                          transition: 'background-color 0.2s',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {submitting ? 'Submitting...' : `Submit with ${changeCount} Change${changeCount !== 1 ? 's' : ''}`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Footer */}
            <div style={{
              marginTop: 24, padding: 16, textAlign: 'center',
              fontSize: 12, color: COLORS.gray, marginBottom: 80,
            }}>
              <p style={{ margin: '0 0 4px' }}>
                <strong>DO NOT PAY</strong> — This is a time record, not an invoice.
              </p>
              <p style={{ margin: 0 }}>
                Questions? Contact <a href="mailto:accounting@mitigationconsulting.com" style={{ color: COLORS.blue }}>accounting@mitigationconsulting.com</a> | 813-962-6855
              </p>
              <p style={{ margin: '4px 0 0' }}>
                <strong>MIT Consulting</strong> — Mitigation Inspection &amp; Testing
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Status Banner Component ────────────────────────────────────────
function StatusBanner({ color, bgColor, title, message }: {
  color: string; bgColor: string; title: string; message: string;
}) {
  return (
    <div style={{
      backgroundColor: bgColor, border: `2px solid ${color}`, borderRadius: 12,
      padding: 24, marginBottom: 24,
    }}>
      <h3 style={{ margin: '0 0 8px', color, fontSize: 16 }}>{title}</h3>
      <p style={{ margin: 0, color: '#333', fontSize: 14, lineHeight: 1.6 }}>{message}</p>
    </div>
  );
}

// ─── Searchable Project Dropdown ─────────────────────────────────────
function ProjectDropdown({ customers, currentProject, entryId, onSelect, onClose }: {
  customers: Customer[];
  currentProject: string | null;
  entryId: number;
  onSelect: (entryId: number, name: string | null) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = customers.filter(c =>
    c.display_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{
      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
      backgroundColor: '#fff', border: '2px solid #7c3aed', borderRadius: 8,
      boxShadow: '0 8px 24px rgba(0,0,0,0.15)', marginTop: 4, overflow: 'hidden',
    }}>
      <div style={{ padding: 8, borderBottom: '1px solid #e5e7eb' }}>
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects..."
          style={{
            width: '100%', padding: '8px 10px', border: '1px solid #d1d5db',
            borderRadius: 6, fontSize: 13, boxSizing: 'border-box',
          }}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        {currentProject && (
          <div
            onClick={(e) => { e.stopPropagation(); onSelect(entryId, null); onClose(); }}
            style={{
              padding: '8px 12px', fontSize: 13, cursor: 'pointer',
              backgroundColor: '#fef2f2', color: COLORS.red, borderBottom: '1px solid #e5e7eb',
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
          >
            \u2715 Remove reassignment
          </div>
        )}
        {filtered.length === 0 && (
          <div style={{ padding: '12px', fontSize: 13, color: COLORS.gray, textAlign: 'center' }}>
            No projects found
          </div>
        )}
        {filtered.map(c => (
          <div
            key={c.id}
            onClick={(e) => { e.stopPropagation(); onSelect(entryId, c.display_name); onClose(); }}
            style={{
              padding: '8px 12px', fontSize: 13, cursor: 'pointer',
              backgroundColor: c.display_name === currentProject ? '#ede9fe' : '#fff',
              borderBottom: '1px solid #f3f4f6',
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f5f3ff'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = c.display_name === currentProject ? '#ede9fe' : '#fff'}
          >
            {c.display_name}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Report Content Component (summary + table with per-row flagging + reassignment) ───
function ReportContent({ entries, totalHours, uniqueDays, reportPeriod, readOnly, flaggedEntries, onToggleFlag, onSetFlagNote, reassignedEntries, onReassign, customers }: {
  entries: TimeEntry[];
  totalHours: number;
  uniqueDays: number;
  reportPeriod: ReportPeriod;
  readOnly?: boolean;
  flaggedEntries?: Map<number, string>;
  onToggleFlag?: (entryId: number) => void;
  onSetFlagNote?: (entryId: number, note: string) => void;
  reassignedEntries?: Map<number, string>;
  onReassign?: (entryId: number, customerName: string | null) => void;
  customers?: Customer[];
}) {
  const canFlag = !readOnly && flaggedEntries && onToggleFlag && onSetFlagNote;
  const canReassign = !readOnly && reassignedEntries && onReassign && customers && customers.length > 0;
  const colCount = (canFlag ? 1 : 0) + 5 + (canReassign ? 1 : 0);
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);

  return (
    <>
      {/* Summary stats */}
      <div style={{
        backgroundColor: COLORS.greenBg, border: '1px solid #bbf7d0', borderRadius: 8,
        display: 'flex', marginBottom: 20, overflow: 'hidden',
      }}>
        <div style={{ flex: 1, padding: 16, textAlign: 'center', borderRight: '1px solid #bbf7d0' }}>
          <p style={{ margin: 0, fontSize: 26, fontWeight: 'bold', color: COLORS.greenDark }}>{totalHours.toFixed(2)}</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: COLORS.greenDark, textTransform: 'uppercase' }}>Total Hours</p>
        </div>
        <div style={{ flex: 1, padding: 16, textAlign: 'center', borderRight: '1px solid #bbf7d0' }}>
          <p style={{ margin: 0, fontSize: 26, fontWeight: 'bold', color: COLORS.greenDark }}>{entries.length}</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: COLORS.greenDark, textTransform: 'uppercase' }}>Entries</p>
        </div>
        <div style={{ flex: 1, padding: 16, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 26, fontWeight: 'bold', color: COLORS.greenDark }}>{uniqueDays}</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: COLORS.greenDark, textTransform: 'uppercase' }}>Days Active</p>
        </div>
      </div>

      {/* Instruction hint for interactive mode */}
      {canFlag && (
        <div style={{
          padding: '10px 16px', marginBottom: 12, backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 13, color: '#1e40af',
        }}>
          Click the flag icon on any entry to mark it for review. Use the reassign button to move an entry to a different project. If everything looks correct, use the <strong>Accept All</strong> button below.
        </div>
      )}

      {/* Activity table */}
      <div style={{
        backgroundColor: '#fff', border: `1px solid ${COLORS.grayBorder}`, borderRadius: 8,
        overflow: 'hidden',
      }}>
        <h3 style={{ margin: 0, padding: '16px 20px 12px', fontSize: 15, color: '#1f2937' }}>Activity Detail</h3>
        <div className="review-table-wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: COLORS.grayLight }}>
                {canFlag && <th style={{ ...thStyle, width: 44, textAlign: 'center', padding: '10px 4px' }}></th>}
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Professional</th>
                <th style={thStyle}>Service</th>
                <th style={{ ...thStyle, width: canReassign ? '50%' : '65%' }}>Description of Services</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Hours</th>
                {canReassign && <th style={{ ...thStyle, width: 140, textAlign: 'center' }}>Reassign</th>}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => {
                const hours = (entry.hours + entry.minutes / 60).toFixed(2);
                const sc = SERVICE_COLORS[entry.cost_code || ''] || { bg: '#f3f4f6', text: '#374151' };
                const isFlagged = flaggedEntries?.has(entry.id);
                const rowBg = isFlagged ? '#fef2f2' : (i % 2 === 1 ? COLORS.grayLight : '#fff');

                return (
                  <React.Fragment key={entry.id}>
                    <tr style={{ backgroundColor: rowBg, borderLeft: isFlagged ? `3px solid ${COLORS.red}` : 'none' }}>
                      {canFlag && (
                        <td
                          style={{ ...tdStyle, textAlign: 'center', padding: '10px 4px', cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => onToggleFlag(entry.id)}
                          title={isFlagged ? 'Remove flag' : 'Flag this entry for review'}
                        >
                          <span style={{ fontSize: 18, opacity: isFlagged ? 1 : 0.3 }}>
                            {isFlagged ? '\u{1F6A9}' : '\u{2691}'}
                          </span>
                        </td>
                      )}
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{fmtShortDate(entry.txn_date)}</td>
                      <td style={tdStyle}>{entry.employee_name || 'Unknown'}</td>
                      <td style={tdStyle}>
                        <span style={{
                          backgroundColor: sc.bg, color: sc.text,
                          padding: '2px 8px', borderRadius: 4, fontSize: 11,
                          display: 'inline-block',
                        }}>
                          {entry.cost_code || 'General'}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, maxWidth: 400, wordBreak: 'break-word' }}>{entry.description || '-'}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{hours}</td>
                      {canReassign && (
                        <td style={{ ...tdStyle, textAlign: 'center', position: 'relative', padding: '6px 8px' }}>
                          {reassignedEntries.has(entry.id) ? (
                            <div>
                              <div
                                onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === entry.id ? null : entry.id); }}
                                style={{
                                  padding: '4px 8px', backgroundColor: '#ede9fe', color: '#7c3aed',
                                  borderRadius: 4, fontSize: 11, cursor: 'pointer', border: '1px solid #c4b5fd',
                                  wordBreak: 'break-word',
                                }}
                                title={`Reassigned to: ${reassignedEntries.get(entry.id)}`}
                              >
                                {'\u2794'} {reassignedEntries.get(entry.id)}
                              </div>
                              {openDropdownId === entry.id && (
                                <ProjectDropdown
                                  customers={customers}
                                  currentProject={reassignedEntries.get(entry.id) || null}
                                  entryId={entry.id}
                                  onSelect={onReassign}
                                  onClose={() => setOpenDropdownId(null)}
                                />
                              )}
                            </div>
                          ) : (
                            <div style={{ position: 'relative' }}>
                              <button
                                onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === entry.id ? null : entry.id); }}
                                style={{
                                  padding: '4px 10px', backgroundColor: '#f5f3ff', color: '#7c3aed',
                                  border: '1px solid #ddd6fe', borderRadius: 4, fontSize: 11,
                                  cursor: 'pointer', whiteSpace: 'nowrap',
                                }}
                                title="Reassign to different project"
                              >
                                {'\u2794'} Move
                              </button>
                              {openDropdownId === entry.id && (
                                <ProjectDropdown
                                  customers={customers}
                                  currentProject={null}
                                  entryId={entry.id}
                                  onSelect={onReassign}
                                  onClose={() => setOpenDropdownId(null)}
                                />
                              )}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                    {/* Per-entry comment field when flagged */}
                    {canFlag && isFlagged && (
                      <tr style={{ backgroundColor: '#fef2f2' }}>
                        <td colSpan={colCount} style={{ padding: '0 12px 12px', borderBottom: `1px solid ${COLORS.grayBorder}` }}>
                          <input
                            type="text"
                            value={flaggedEntries.get(entry.id) || ''}
                            onChange={(e) => onSetFlagNote(entry.id, e.target.value)}
                            placeholder="What's the concern with this entry? (optional)"
                            style={{
                              width: '100%', padding: '8px 12px', border: '1px solid #fca5a5',
                              borderRadius: 6, fontSize: 13, fontFamily: 'Arial, sans-serif',
                              backgroundColor: '#fff', boxSizing: 'border-box',
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: COLORS.greenBg }}>
                <td colSpan={colCount - 1} style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', color: COLORS.greenDark }}>
                  Week Total:
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', fontSize: 16, color: COLORS.greenDark }}>
                  {totalHours.toFixed(2)} hrs
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}

// ─── Table cell styles ──────────────────────────────────────────────
const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  border: '2px solid #d1d5db',
  color: '#374151',
  fontSize: 11,
  textTransform: 'uppercase',
  fontWeight: 600,
  verticalAlign: 'top',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  border: '2px solid #d1d5db',
  verticalAlign: 'top',
};
