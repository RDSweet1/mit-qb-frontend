'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase, callEdgeFunction } from '@/lib/supabaseClient';

// ─── Types ──────────────────────────────────────────────────────────
interface InternalReviewToken {
  id: number;
  assignment_id: number;
  token: string;
  expires_at: string;
  first_opened_at: string | null;
  last_opened_at: string | null;
  open_count: number;
}

interface InternalAssignment {
  id: number;
  time_entry_id: number;
  assigned_by: string;
  assigned_to_email: string;
  assigned_to_name: string;
  question: string;
  suggested_description: string | null;
  status: string;
  batch_id: string | null;
  created_at: string;
  responded_at: string | null;
  cleared_at: string | null;
}

interface InternalMessage {
  id: number;
  assignment_id: number;
  sender_email: string;
  sender_name: string;
  sender_role: 'admin' | 'assignee';
  message: string;
  suggested_description: string | null;
  created_at: string;
}

interface TimeEntry {
  id: number;
  txn_date: string;
  employee_name: string;
  qb_customer_id: string;
  cost_code: string | null;
  description: string | null;
  hours: number;
  minutes: number;
}

type PageState = 'loading' | 'not_found' | 'expired' | 'active' | 'submitted' | 'cleared';

// ─── Colors ──────────────────────────────────────────────────────────
const COLORS = {
  amber: '#d97706',
  amberDark: '#92400e',
  amberBg: '#fffbeb',
  amberBorder: '#f59e0b',
  blue: '#2563eb',
  blueDark: '#1e40af',
  green: '#16a34a',
  greenDark: '#166534',
  greenBg: '#f0fdf4',
  gray: '#6b7280',
  grayLight: '#f9fafb',
  grayBorder: '#e5e7eb',
  red: '#dc2626',
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

const MIT_LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAhklEQVR42u2WSw6AMAhE5zKezON7iLpyU+OAfCZGJd1BeC2UD5Z1az34AbWAcUglYFiSAhBHTgby0eCWKIk1sWeAQP5dAO6dq85a3L27qZ0MXglIVjIDmOn1FNekjQOuekYZIPKC9hzEarj4mz4ekGG4epGimyrmQftEU8xk0Vah2Is+v5vuGba66UdGBNoAAAAASUVORK5CYII=';

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
}

function fmtDateTime(isoStr: string): string {
  return new Date(isoStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

// ─── Main Component ─────────────────────────────────────────────────
export default function ClarifyPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const batchId = searchParams.get('batch');

  const [pageState, setPageState] = useState<PageState>('loading');
  const [reviewToken, setReviewToken] = useState<InternalReviewToken | null>(null);
  const [assignments, setAssignments] = useState<InternalAssignment[]>([]);
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({});
  const [replyText, setReplyText] = useState('');
  const [suggestedDesc, setSuggestedDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const visitLogged = useRef(false);

  const loadData = useCallback(async () => {
    if (!token) {
      setPageState('not_found');
      return;
    }

    try {
      // 1. Fetch internal review token
      const { data: tokenData, error: tokenErr } = await supabase
        .from('internal_review_tokens')
        .select('*')
        .eq('token', token)
        .single();

      if (tokenErr || !tokenData) {
        setPageState('not_found');
        return;
      }

      setReviewToken(tokenData);

      // Check expiry
      if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
        setPageState('expired');
        return;
      }

      // 2. Fetch assignment(s) — single or batch
      let assignmentQuery = supabase
        .from('internal_assignments')
        .select('*');

      if (batchId) {
        assignmentQuery = assignmentQuery.eq('batch_id', batchId);
      } else {
        assignmentQuery = assignmentQuery.eq('id', tokenData.assignment_id);
      }

      const { data: assignData } = await assignmentQuery.order('id', { ascending: true });

      if (!assignData?.length) {
        setPageState('not_found');
        return;
      }

      setAssignments(assignData);

      // Check if all assignments are cleared
      const allCleared = assignData.every(a => a.status === 'cleared' || a.status === 'cancelled');
      if (allCleared) {
        setPageState('cleared');
      }

      // 3. Fetch messages for all assignments
      const assignmentIds = assignData.map(a => a.id);
      const { data: msgData } = await supabase
        .from('internal_messages')
        .select('*')
        .in('assignment_id', assignmentIds)
        .order('created_at', { ascending: true });

      setMessages(msgData || []);

      // 4. Fetch time entries
      const entryIds = assignData.map(a => a.time_entry_id);
      const { data: entryData } = await supabase
        .from('time_entries')
        .select('id, txn_date, employee_name, qb_customer_id, cost_code, description, hours, minutes')
        .in('id', entryIds)
        .order('txn_date', { ascending: true });

      setEntries(entryData || []);

      // 5. Look up customer names
      if (entryData?.length) {
        const custIds = [...new Set(entryData.map(e => e.qb_customer_id))];
        const { data: custData } = await supabase
          .from('customers')
          .select('qb_customer_id, display_name')
          .in('qb_customer_id', custIds);

        const names: Record<string, string> = {};
        (custData || []).forEach(c => { names[c.qb_customer_id] = c.display_name; });
        setCustomerNames(names);
      }

      // Pre-fill suggested description from current entry description (single entry only)
      if (entryData?.length === 1) {
        setSuggestedDesc(entryData[0].description || '');
      }

      // 6. Log visit
      if (!visitLogged.current) {
        visitLogged.current = true;
        await supabase
          .from('internal_review_tokens')
          .update({
            last_opened_at: new Date().toISOString(),
            open_count: (tokenData.open_count || 0) + 1,
            ...(!tokenData.first_opened_at ? { first_opened_at: new Date().toISOString() } : {}),
          })
          .eq('id', tokenData.id);
      }

      if (!allCleared) {
        setPageState('active');
      }
    } catch (err: any) {
      console.error('Error loading clarification data:', err);
      setErrorMsg(err.message || 'Failed to load data');
      setPageState('not_found');
    }
  }, [token, batchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Handle Submit ──────────────────────────────────────────────
  async function handleSubmit() {
    if (!replyText.trim() || !reviewToken || submitting) return;
    setSubmitting(true);

    try {
      await callEdgeFunction('internal-clarify-response', {
        token: reviewToken.token,
        message: replyText.trim(),
        suggested_description: suggestedDesc.trim() || undefined,
      });

      setPageState('submitted');
    } catch (err: any) {
      alert('Error submitting response: ' + (err.message || 'Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  const primaryAssignment = assignments[0];

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div style={{ backgroundColor: COLORS.amber, padding: '24px 0' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src={MIT_LOGO} width={32} height={32} alt="MIT" style={{ borderRadius: 4 }} />
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 'bold', color: '#fff' }}>
              Internal Clarification Request
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: '#fef3c7' }}>
              Mitigation Inspection &amp; Testing — MIT Consulting
            </p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 24px 48px' }}>
        {/* Loading */}
        {pageState === 'loading' && (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <div style={{
              width: 40, height: 40, border: `4px solid ${COLORS.grayBorder}`,
              borderTopColor: COLORS.amber, borderRadius: '50%',
              animation: 'spin 1s linear infinite', margin: '0 auto 16px',
            }} />
            <p style={{ color: COLORS.gray }}>Loading...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Not Found */}
        {pageState === 'not_found' && (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#128275;</div>
            <h2 style={{ margin: '0 0 8px', color: '#111' }}>Link Not Found</h2>
            <p style={{ color: COLORS.gray, maxWidth: 400, margin: '0 auto' }}>
              This clarification link is not valid. Please check the link in your email or contact
              the office at <a href="mailto:accounting@mitigationconsulting.com" style={{ color: COLORS.blue }}>accounting@mitigationconsulting.com</a>.
            </p>
          </div>
        )}

        {/* Expired */}
        {pageState === 'expired' && (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#9203;</div>
            <h2 style={{ margin: '0 0 8px', color: COLORS.amberDark }}>Link Expired</h2>
            <p style={{ color: COLORS.gray, maxWidth: 400, margin: '0 auto' }}>
              This clarification link has expired. Please contact the office for a new link.
            </p>
          </div>
        )}

        {/* Cleared */}
        {pageState === 'cleared' && primaryAssignment && (
          <div style={{
            backgroundColor: COLORS.greenBg, border: `2px solid ${COLORS.green}`, borderRadius: 12,
            padding: 32, textAlign: 'center', marginBottom: 24,
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>&#10003;</div>
            <h2 style={{ margin: '0 0 8px', color: COLORS.greenDark, fontSize: 20 }}>
              Clarification Resolved
            </h2>
            <p style={{ margin: 0, color: COLORS.greenDark, fontSize: 14 }}>
              This clarification request has been resolved. No further action is needed. Thank you!
            </p>
          </div>
        )}

        {/* Submitted */}
        {pageState === 'submitted' && (
          <div style={{
            backgroundColor: COLORS.greenBg, border: `2px solid ${COLORS.green}`, borderRadius: 12,
            padding: 32, textAlign: 'center', marginBottom: 24,
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>&#10003;</div>
            <h2 style={{ margin: '0 0 8px', color: COLORS.greenDark, fontSize: 20 }}>
              Response Submitted
            </h2>
            <p style={{ margin: 0, color: COLORS.greenDark, fontSize: 14, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
              Thank you! Your response has been sent. The office will review and follow up if needed.
              You can close this page.
            </p>
          </div>
        )}

        {/* Active — Entry Details + Conversation + Reply Form */}
        {pageState === 'active' && primaryAssignment && (
          <>
            {/* Status badge */}
            <div style={{
              backgroundColor: COLORS.amberBg, border: `2px solid ${COLORS.amberBorder}`, borderRadius: 12,
              padding: 20, marginBottom: 24,
            }}>
              <h3 style={{ margin: '0 0 8px', color: COLORS.amberDark, fontSize: 15 }}>
                &#128172; Awaiting Your Response
              </h3>
              <p style={{ margin: 0, color: '#78350f', fontSize: 13, lineHeight: 1.6 }}>
                Please review the time {entries.length === 1 ? 'entry' : 'entries'} below, answer the question, and optionally suggest an updated description.
              </p>
            </div>

            {/* Entry Details */}
            <div style={{
              backgroundColor: '#fff', border: `1px solid ${COLORS.grayBorder}`, borderRadius: 8,
              overflow: 'hidden', marginBottom: 20,
            }}>
              <h3 style={{ margin: 0, padding: '16px 20px 12px', fontSize: 15, color: '#1f2937' }}>
                Time {entries.length === 1 ? 'Entry' : 'Entries'}
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ backgroundColor: COLORS.grayLight }}>
                      <th style={thStyle}>Date</th>
                      <th style={thStyle}>Employee</th>
                      <th style={thStyle}>Customer</th>
                      <th style={thStyle}>Service</th>
                      <th style={{ ...thStyle, width: '35%' }}>Current Description</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, i) => {
                      const hours = (entry.hours + entry.minutes / 60).toFixed(2);
                      const sc = SERVICE_COLORS[entry.cost_code || ''] || { bg: '#f3f4f6', text: '#374151' };
                      return (
                        <tr key={entry.id} style={{ backgroundColor: i % 2 === 1 ? COLORS.grayLight : '#fff' }}>
                          <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{fmtDate(entry.txn_date)}</td>
                          <td style={tdStyle}>{entry.employee_name}</td>
                          <td style={tdStyle}>{customerNames[entry.qb_customer_id] || entry.qb_customer_id}</td>
                          <td style={tdStyle}>
                            <span style={{
                              backgroundColor: sc.bg, color: sc.text,
                              padding: '2px 8px', borderRadius: 4, fontSize: 11, display: 'inline-block',
                            }}>
                              {entry.cost_code || 'General'}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, maxWidth: 300, wordBreak: 'break-word' }}>{entry.description || '-'}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold' }}>{hours}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Question Box */}
            <div style={{
              backgroundColor: COLORS.amberBg, border: `2px solid ${COLORS.amberBorder}`, borderRadius: 8,
              padding: 20, marginBottom: 20,
            }}>
              <h4 style={{ margin: '0 0 8px', color: COLORS.amberDark, fontSize: 14 }}>
                Question from {primaryAssignment.assigned_by.split('@')[0]}
              </h4>
              <p style={{ margin: 0, color: '#78350f', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {primaryAssignment.question}
              </p>
            </div>

            {/* Conversation Thread */}
            {messages.length > 1 && (
              <div style={{
                backgroundColor: '#fff', border: `1px solid ${COLORS.grayBorder}`, borderRadius: 8,
                padding: 20, marginBottom: 20,
              }}>
                <h4 style={{ margin: '0 0 16px', fontSize: 14, color: '#1f2937' }}>Conversation</h4>
                {messages.map((msg) => {
                  const isAdmin = msg.sender_role === 'admin';
                  return (
                    <div key={msg.id} style={{
                      display: 'flex',
                      justifyContent: isAdmin ? 'flex-start' : 'flex-end',
                      marginBottom: 12,
                    }}>
                      <div style={{
                        maxWidth: '75%',
                        padding: '12px 16px',
                        borderRadius: 12,
                        backgroundColor: isAdmin ? '#eff6ff' : COLORS.greenBg,
                        border: `1px solid ${isAdmin ? '#bfdbfe' : '#bbf7d0'}`,
                      }}>
                        <div style={{ fontSize: 11, color: COLORS.gray, marginBottom: 4 }}>
                          <strong>{msg.sender_name}</strong> &middot; {fmtDateTime(msg.created_at)}
                        </div>
                        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                          {msg.message}
                        </p>
                        {msg.suggested_description && (
                          <div style={{
                            marginTop: 8, padding: '8px 12px',
                            backgroundColor: '#fefce8', border: '1px solid #fde68a', borderRadius: 6,
                            fontSize: 13,
                          }}>
                            <strong style={{ color: COLORS.amberDark }}>Suggested description:</strong>
                            <p style={{ margin: '4px 0 0' }}>{msg.suggested_description}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Reply Form */}
            <div style={{
              backgroundColor: '#fff', border: `1px solid ${COLORS.grayBorder}`, borderRadius: 12,
              padding: 28, marginBottom: 24,
            }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#111' }}>Your Response</h3>

              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Reply <span style={{ color: COLORS.red }}>*</span>
              </label>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Explain what was done during this time, any additional context..."
                style={{
                  width: '100%', minHeight: 100, padding: 12, border: `1px solid ${COLORS.grayBorder}`,
                  borderRadius: 8, fontSize: 14, fontFamily: 'Arial, sans-serif', resize: 'vertical',
                  boxSizing: 'border-box', marginBottom: 16,
                }}
              />

              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Suggested Description <span style={{ color: COLORS.gray, fontWeight: 400 }}>(optional — will be shown to admin for approval)</span>
              </label>
              <textarea
                value={suggestedDesc}
                onChange={(e) => setSuggestedDesc(e.target.value)}
                placeholder="Suggest an updated description for the time entry..."
                style={{
                  width: '100%', minHeight: 60, padding: 12, border: `1px solid ${COLORS.grayBorder}`,
                  borderRadius: 8, fontSize: 14, fontFamily: 'Arial, sans-serif', resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />

              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleSubmit}
                  disabled={!replyText.trim() || submitting}
                  style={{
                    padding: '12px 32px',
                    backgroundColor: !replyText.trim() || submitting ? '#9ca3af' : COLORS.amber,
                    color: '#fff', border: 'none', borderRadius: 8,
                    fontSize: 15, fontWeight: 'bold', cursor: !replyText.trim() || submitting ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                >
                  {submitting ? 'Submitting...' : 'Submit Response'}
                </button>
              </div>
            </div>

            {/* Footer */}
            <div style={{ textAlign: 'center', fontSize: 12, color: COLORS.gray, marginTop: 24 }}>
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
