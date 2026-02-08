'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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

type PageState = 'loading' | 'not_found' | 'expired' | 'already_actioned' | 'review' | 'submitted' | 'error';

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
  const visitLogged = useRef(false);

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

  // ─── Handle Accept ──────────────────────────────────────────────
  async function handleAccept() {
    if (!reviewToken || !reportPeriod || submitting) return;
    setSubmitting(true);

    try {
      await callEdgeFunction('customer-review-action', {
        token: reviewToken.token,
        action: 'accepted',
        notes: customerNotes || undefined,
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
    if (!customerNotes.trim()) {
      alert('Please enter your comments before submitting.');
      return;
    }
    setSubmitting(true);

    try {
      await callEdgeFunction('customer-review-action', {
        token: reviewToken.token,
        action: 'disputed',
        notes: customerNotes,
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
      {/* Header */}
      <div style={{ backgroundColor: COLORS.blue, padding: '24px 0' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
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
          <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 24px 48px' }}>
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

            {/* Report content */}
            <ReportContent entries={entries} totalHours={totalHours} uniqueDays={uniqueDays} reportPeriod={reportPeriod} />

            {/* ─── Action Section ───────────────── */}
            <div style={{
              backgroundColor: '#fff', border: `1px solid ${COLORS.grayBorder}`, borderRadius: 12,
              padding: 28, marginTop: 24,
            }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#111' }}>Your Response</h3>

              {/* Comments area */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, color: COLORS.gray, marginBottom: 6 }}>
                  Comments or Concerns (optional for acceptance, required for disputes)
                </label>
                <textarea
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="If you have any notes, clarifications, or concerns regarding the time entries above, please enter them here..."
                  style={{
                    width: '100%', minHeight: 100, padding: 12, border: `1px solid ${COLORS.grayBorder}`,
                    borderRadius: 8, fontSize: 14, fontFamily: 'Arial, sans-serif', resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button
                  onClick={handleAccept}
                  disabled={submitting}
                  style={{
                    flex: 1, minWidth: 200, padding: '14px 24px',
                    backgroundColor: submitting ? '#9ca3af' : COLORS.green,
                    color: '#fff', border: 'none', borderRadius: 8,
                    fontSize: 15, fontWeight: 'bold', cursor: submitting ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseOver={(e) => { if (!submitting) e.currentTarget.style.backgroundColor = COLORS.greenDark; }}
                  onMouseOut={(e) => { if (!submitting) e.currentTarget.style.backgroundColor = COLORS.green; }}
                >
                  {submitting ? 'Submitting...' : '✓  Accept as Accurate'}
                </button>
                <button
                  onClick={handleSubmitComments}
                  disabled={submitting}
                  style={{
                    flex: 1, minWidth: 200, padding: '14px 24px',
                    backgroundColor: submitting ? '#e5e7eb' : '#fff',
                    color: submitting ? '#9ca3af' : COLORS.blue,
                    border: `2px solid ${submitting ? '#e5e7eb' : COLORS.blue}`, borderRadius: 8,
                    fontSize: 15, fontWeight: 'bold', cursor: submitting ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) => { if (!submitting) { e.currentTarget.style.backgroundColor = '#eff6ff'; } }}
                  onMouseOut={(e) => { if (!submitting) { e.currentTarget.style.backgroundColor = '#fff'; } }}
                >
                  Submit Comments
                </button>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              marginTop: 24, padding: 16, textAlign: 'center',
              fontSize: 12, color: COLORS.gray,
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

// ─── Report Content Component (summary + table) ────────────────────
function ReportContent({ entries, totalHours, uniqueDays, reportPeriod, readOnly }: {
  entries: TimeEntry[];
  totalHours: number;
  uniqueDays: number;
  reportPeriod: ReportPeriod;
  readOnly?: boolean;
}) {
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

      {/* Activity table */}
      <div style={{
        backgroundColor: '#fff', border: `1px solid ${COLORS.grayBorder}`, borderRadius: 8,
        overflow: 'hidden',
      }}>
        <h3 style={{ margin: 0, padding: '16px 20px 12px', fontSize: 15, color: '#1f2937' }}>Activity Detail</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: COLORS.grayLight }}>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Professional</th>
                <th style={thStyle}>Service</th>
                <th style={{ ...thStyle, width: '45%' }}>Description of Services</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Hours</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => {
                const hours = (entry.hours + entry.minutes / 60).toFixed(2);
                const sc = SERVICE_COLORS[entry.cost_code || ''] || { bg: '#f3f4f6', text: '#374151' };
                return (
                  <tr key={entry.id} style={{ backgroundColor: i % 2 === 1 ? COLORS.grayLight : '#fff' }}>
                    <td style={tdStyle}>{fmtShortDate(entry.txn_date)}</td>
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
                    <td style={tdStyle}>{entry.description || '-'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold' }}>{hours}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: COLORS.greenBg }}>
                <td colSpan={4} style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', color: COLORS.greenDark }}>
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
  borderBottom: `1px solid ${COLORS.grayBorder}`,
  color: '#374151',
  fontSize: 11,
  textTransform: 'uppercase',
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: `1px solid ${COLORS.grayBorder}`,
};
