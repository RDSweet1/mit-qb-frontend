'use client';

import { useState, useEffect, useMemo } from 'react';
import { MessageSquare, CheckCircle, Clock, Send, ChevronDown, ChevronUp, X, RefreshCw } from 'lucide-react';
import { supabase, callEdgeFunction } from '@/lib/supabaseClient';
import { useMsal } from '@azure/msal-react';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';

// ─── Types ──────────────────────────────────────────────────────────
interface Assignment {
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
  cleared_by: string | null;
}

interface Message {
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

interface Customer {
  qb_customer_id: string;
  display_name: string;
}

type StatusFilter = 'all' | 'pending' | 'responded' | 'cleared';

// ─── Main Component ─────────────────────────────────────────────────
export default function InternalReviewPage() {
  const { accounts } = useMsal();
  const user = accounts[0];

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [timeEntries, setTimeEntries] = useState<Record<number, TimeEntry>>({});
  const [customers, setCustomers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [clearing, setClearing] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load assignments
      const { data: assignData } = await supabase
        .from('internal_assignments')
        .select('*')
        .order('created_at', { ascending: false });

      setAssignments(assignData || []);

      // Load all messages
      if (assignData?.length) {
        const ids = assignData.map(a => a.id);
        const { data: msgData } = await supabase
          .from('internal_messages')
          .select('*')
          .in('assignment_id', ids)
          .order('created_at', { ascending: true });
        setMessages(msgData || []);

        // Load time entries
        const entryIds = [...new Set(assignData.map(a => a.time_entry_id))];
        const { data: entryData } = await supabase
          .from('time_entries')
          .select('id, txn_date, employee_name, qb_customer_id, cost_code, description, hours, minutes')
          .in('id', entryIds);

        const entryMap: Record<number, TimeEntry> = {};
        (entryData || []).forEach(e => { entryMap[e.id] = e; });
        setTimeEntries(entryMap);

        // Load customer names
        const custIds = [...new Set((entryData || []).map(e => e.qb_customer_id))];
        if (custIds.length) {
          const { data: custData } = await supabase
            .from('customers')
            .select('qb_customer_id, display_name')
            .in('qb_customer_id', custIds);
          const custMap: Record<string, string> = {};
          (custData || []).forEach(c => { custMap[c.qb_customer_id] = c.display_name; });
          setCustomers(custMap);
        }
      }
    } catch (err) {
      console.error('Error loading assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // ─── Filtered assignments ──────────────────────────────────────
  const filtered = useMemo(() => {
    if (statusFilter === 'all') return assignments;
    return assignments.filter(a => a.status === statusFilter);
  }, [assignments, statusFilter]);

  // ─── Stats ─────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const pending = assignments.filter(a => a.status === 'pending').length;
    const responded = assignments.filter(a => a.status === 'responded').length;
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const clearedThisWeek = assignments.filter(a => a.status === 'cleared' && a.cleared_at && new Date(a.cleared_at) > weekAgo).length;
    return { pending, responded, clearedThisWeek };
  }, [assignments]);

  // ─── Reply Handler ─────────────────────────────────────────────
  const handleReply = async (assignmentId: number) => {
    if (!replyText.trim() || replying) return;
    setReplying(true);
    try {
      await callEdgeFunction('reply-internal-assignment', {
        assignment_id: assignmentId,
        admin_email: user?.username || '',
        message: replyText.trim(),
      });
      setReplyText('');
      await loadData();
    } catch (err: any) {
      alert('Error sending reply: ' + (err.message || 'Please try again'));
    } finally {
      setReplying(false);
    }
  };

  // ─── Clear Handler ─────────────────────────────────────────────
  const handleClear = async (assignment: Assignment, applyDesc: boolean) => {
    setClearing(assignment.id);
    try {
      await callEdgeFunction('clear-internal-assignment', {
        assignment_id: assignment.id,
        admin_email: user?.username || '',
        apply_suggested_description: applyDesc,
      });
      await loadData();
      setExpandedId(null);
    } catch (err: any) {
      alert('Error clearing assignment: ' + (err.message || 'Please try again'));
    } finally {
      setClearing(null);
    }
  };

  // ─── Helper: format date ──────────────────────────────────────
  function fmtDate(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  }

  function fmtDateTime(isoStr: string): string {
    return new Date(isoStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  }

  return (
    <AppShell>
      <PageHeader
        title="Internal Clarifications"
        subtitle="Manage clarification requests with field techs"
        icon={<MessageSquare className="w-6 h-6 text-amber-600" />}
        actions={
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <button
              onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${statusFilter === 'pending' ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white hover:border-amber-200'}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                  <p className="text-sm text-gray-600">Pending Response</p>
                </div>
                <Clock className="w-8 h-8 text-amber-400" />
              </div>
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === 'responded' ? 'all' : 'responded')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${statusFilter === 'responded' ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white hover:border-green-200'}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-green-600">{stats.responded}</p>
                  <p className="text-sm text-gray-600">Needs Review</p>
                </div>
                <MessageSquare className="w-8 h-8 text-green-400" />
              </div>
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === 'cleared' ? 'all' : 'cleared')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${statusFilter === 'cleared' ? 'border-gray-400 bg-gray-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-600">{stats.clearedThisWeek}</p>
                  <p className="text-sm text-gray-600">Cleared This Week</p>
                </div>
                <CheckCircle className="w-8 h-8 text-gray-400" />
              </div>
            </button>
          </div>

          {/* Filter bar */}
          <div className="flex items-center gap-2 mb-4">
            {(['all', 'pending', 'responded', 'cleared'] as StatusFilter[]).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${statusFilter === s ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}
              >
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
            <span className="text-sm text-gray-500 ml-2">{filtered.length} assignments</span>
          </div>

          {/* Loading */}
          {loading && (
            <div className="text-center py-16">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
              <p className="mt-3 text-gray-500">Loading assignments...</p>
            </div>
          )}

          {/* Empty */}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
              <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No Assignments</h3>
              <p className="text-sm text-gray-500">
                {statusFilter === 'all'
                  ? 'No clarification requests yet. Use the Time Entries page to create one.'
                  : `No ${statusFilter} assignments found.`}
              </p>
            </div>
          )}

          {/* Assignment Cards */}
          {!loading && filtered.map(assignment => {
            const entry = timeEntries[assignment.time_entry_id];
            const custName = entry ? (customers[entry.qb_customer_id] || entry.qb_customer_id) : 'Unknown';
            const assignMsgs = messages.filter(m => m.assignment_id === assignment.id);
            const isExpanded = expandedId === assignment.id;
            const latestReply = [...assignMsgs].reverse().find(m => m.sender_role === 'assignee');

            const statusColors: Record<string, string> = {
              pending: 'bg-amber-100 text-amber-800',
              responded: 'bg-green-100 text-green-800',
              cleared: 'bg-gray-100 text-gray-600',
              cancelled: 'bg-red-100 text-red-600',
            };

            return (
              <div key={assignment.id} className="bg-white rounded-xl border border-gray-200 mb-3 overflow-hidden">
                {/* Card header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : assignment.id)}
                  className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${statusColors[assignment.status] || 'bg-gray-100'}`}>
                    {assignment.status}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-gray-900 truncate">
                        {entry ? `${entry.employee_name} — ${fmtDate(entry.txn_date)}` : 'Loading...'}
                      </span>
                      <span className="text-gray-400">&middot;</span>
                      <span className="text-gray-500 truncate">{custName}</span>
                      {entry && (
                        <>
                          <span className="text-gray-400">&middot;</span>
                          <span className="font-semibold text-gray-700">{(entry.hours + entry.minutes / 60).toFixed(2)}h</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      To: {assignment.assigned_to_name} &middot; {fmtDateTime(assignment.created_at)}
                      {latestReply && (
                        <span className="text-green-600 ml-2">
                          &middot; Last reply: {fmtDateTime(latestReply.created_at)}
                        </span>
                      )}
                    </p>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-4">
                    {/* Entry details */}
                    {entry && (
                      <div className="p-3 bg-gray-50 rounded-lg mb-4 text-sm">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div><span className="text-gray-500">Date:</span> <span className="font-medium">{fmtDate(entry.txn_date)}</span></div>
                          <div><span className="text-gray-500">Employee:</span> <span className="font-medium">{entry.employee_name}</span></div>
                          <div><span className="text-gray-500">Customer:</span> <span className="font-medium">{custName}</span></div>
                          <div><span className="text-gray-500">Hours:</span> <span className="font-medium">{(entry.hours + entry.minutes / 60).toFixed(2)}</span></div>
                        </div>
                        {entry.cost_code && (
                          <div className="mt-1"><span className="text-gray-500">Service:</span> <span className="font-medium">{entry.cost_code}</span></div>
                        )}
                        <div className="mt-1"><span className="text-gray-500">Current Description:</span> <span className="font-medium">{entry.description || '-'}</span></div>
                      </div>
                    )}

                    {/* Conversation thread */}
                    <div className="space-y-3 mb-4">
                      {assignMsgs.map(msg => {
                        const isAdmin = msg.sender_role === 'admin';
                        return (
                          <div key={msg.id} className={`flex ${isAdmin ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-[75%] px-4 py-3 rounded-xl ${isAdmin ? 'bg-blue-50 border border-blue-100' : 'bg-green-50 border border-green-100'}`}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold text-gray-700">{msg.sender_name}</span>
                                <span className="text-xs text-gray-400">{fmtDateTime(msg.created_at)}</span>
                              </div>
                              <p className="text-sm text-gray-800 whitespace-pre-wrap">{msg.message}</p>
                              {msg.suggested_description && (
                                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                                  <p className="text-xs font-semibold text-amber-800 mb-1">Suggested Description:</p>
                                  <p className="text-sm text-gray-800">{msg.suggested_description}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Actions */}
                    {(assignment.status === 'pending' || assignment.status === 'responded') && (
                      <div className="space-y-3 border-t border-gray-100 pt-4">
                        {/* Reply form */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={expandedId === assignment.id ? replyText : ''}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Type a follow-up message..."
                            className="flex-1 p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none"
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(assignment.id); } }}
                          />
                          <button
                            onClick={() => handleReply(assignment.id)}
                            disabled={!replyText.trim() || replying}
                            className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                          >
                            <Send className="w-3.5 h-3.5" />
                            {replying ? '...' : 'Reply'}
                          </button>
                        </div>

                        {/* Clear buttons */}
                        <div className="flex gap-2">
                          {assignment.suggested_description && entry && assignment.suggested_description !== entry.description && (
                            <button
                              onClick={() => handleClear(assignment, true)}
                              disabled={clearing === assignment.id}
                              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              <CheckCircle className="w-4 h-4" />
                              {clearing === assignment.id ? 'Clearing...' : 'Apply Suggested Desc & Clear'}
                            </button>
                          )}
                          <button
                            onClick={() => handleClear(assignment, false)}
                            disabled={clearing === assignment.id}
                            className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            <CheckCircle className="w-4 h-4" />
                            {clearing === assignment.id ? 'Clearing...' : 'Clear Without Changes'}
                          </button>
                        </div>

                        {/* Show diff if suggested description differs */}
                        {assignment.suggested_description && entry && assignment.suggested_description !== entry.description && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                            <p className="font-semibold text-amber-800 mb-2">Suggested vs. Current Description:</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Current:</p>
                                <p className="text-gray-700 bg-white p-2 rounded border border-gray-200">{entry.description || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-green-600 mb-1">Suggested:</p>
                                <p className="text-gray-700 bg-green-50 p-2 rounded border border-green-200">{assignment.suggested_description}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Cleared info */}
                    {assignment.status === 'cleared' && (
                      <div className="border-t border-gray-100 pt-3">
                        <p className="text-sm text-gray-500">
                          Cleared by {assignment.cleared_by}
                          {assignment.cleared_at && ` on ${fmtDateTime(assignment.cleared_at)}`}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
    </AppShell>
  );
}
