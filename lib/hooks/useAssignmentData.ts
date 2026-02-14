import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { InternalAssignment, InternalMessage, InternalReviewToken, TimeEntrySummary } from '@/lib/types';

interface AssignmentDataResult {
  assignments: InternalAssignment[];
  messages: InternalMessage[];
  entries: Record<number, TimeEntrySummary>;
  customers: Record<string, string>;
  reviewToken: InternalReviewToken | null;
  loading: boolean;
  error: string | null;
  expired: boolean;
  allCleared: boolean;
  reload: () => Promise<void>;
}

interface UseAssignmentDataOptions {
  /** Token for public /clarify page (token-gated access) */
  token?: string | null;
  /** Batch ID for batch clarification mode */
  batchId?: string | null;
  /** Fetch all assignments (for admin /internal-review dashboard) */
  fetchAll?: boolean;
}

const ENTRY_SELECT = 'id, txn_date, employee_name, qb_customer_id, cost_code, description, hours, minutes';

export function useAssignmentData({ token, batchId, fetchAll = false }: UseAssignmentDataOptions): AssignmentDataResult {
  const [assignments, setAssignments] = useState<InternalAssignment[]>([]);
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [entries, setEntries] = useState<Record<number, TimeEntrySummary>>({});
  const [customers, setCustomers] = useState<Record<string, string>>({});
  const [reviewToken, setReviewToken] = useState<InternalReviewToken | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [allCleared, setAllCleared] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // --- Token-gated mode: validate token first ---
      let assignmentFilter: { field: string; value: any } | null = null;

      if (!fetchAll && token) {
        const { data: tokenData, error: tokenErr } = await supabase
          .from('internal_review_tokens')
          .select('*')
          .eq('token', token)
          .single();

        if (tokenErr || !tokenData) {
          setError('not_found');
          setLoading(false);
          return;
        }

        setReviewToken(tokenData as InternalReviewToken);

        if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
          setExpired(true);
          setLoading(false);
          return;
        }

        assignmentFilter = batchId
          ? { field: 'batch_id', value: batchId }
          : { field: 'id', value: tokenData.assignment_id };
      } else if (!fetchAll && !token) {
        setError('not_found');
        setLoading(false);
        return;
      }

      // --- Fetch assignments ---
      let query = supabase.from('internal_assignments').select('*');

      if (assignmentFilter) {
        query = query.eq(assignmentFilter.field, assignmentFilter.value);
      }

      query = fetchAll
        ? query.order('created_at', { ascending: false })
        : query.order('id', { ascending: true });

      const { data: assignData } = await query;

      if (!assignData?.length) {
        if (!fetchAll) setError('not_found');
        setAssignments([]);
        setLoading(false);
        return;
      }

      setAssignments(assignData as InternalAssignment[]);
      setAllCleared(assignData.every((a: any) => a.status === 'cleared' || a.status === 'cancelled'));

      // --- Fetch messages ---
      const ids = assignData.map((a: any) => a.id);
      const { data: msgData } = await supabase
        .from('internal_messages')
        .select('*')
        .in('assignment_id', ids)
        .order('created_at', { ascending: true });

      setMessages((msgData || []) as InternalMessage[]);

      // --- Fetch time entries ---
      const entryIds = [...new Set(assignData.map((a: any) => a.time_entry_id))];
      const { data: entryData } = await supabase
        .from('time_entries')
        .select(ENTRY_SELECT)
        .in('id', entryIds);

      const entryMap: Record<number, TimeEntrySummary> = {};
      (entryData || []).forEach((e: any) => { entryMap[e.id] = e; });
      setEntries(entryMap);

      // --- Fetch customer names ---
      const custIds = [...new Set((entryData || []).map((e: any) => e.qb_customer_id))];
      if (custIds.length) {
        const { data: custData } = await supabase
          .from('customers')
          .select('qb_customer_id, display_name')
          .in('qb_customer_id', custIds);

        const custMap: Record<string, string> = {};
        (custData || []).forEach((c: any) => { custMap[c.qb_customer_id] = c.display_name; });
        setCustomers(custMap);
      }
    } catch (err: any) {
      console.error('Error loading assignment data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [token, batchId, fetchAll]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { assignments, messages, entries, customers, reviewToken, loading, error, expired, allCleared, reload: loadData };
}
