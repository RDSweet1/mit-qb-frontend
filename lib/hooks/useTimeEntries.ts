import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { TimeEntry } from '@/lib/types';

interface UseTimeEntriesFilters {
  startDate: string;
  endDate: string;
  customer?: string;
  employee?: string;
}

interface UseTimeEntriesResult {
  entries: TimeEntry[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  reload: () => Promise<void>;
}

export function useTimeEntries(filters: UseTimeEntriesFilters): UseTimeEntriesResult {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('time_entries')
        .select('*')
        .gte('txn_date', filters.startDate)
        .lte('txn_date', filters.endDate);

      if (filters.customer && filters.customer !== 'all') {
        query = query.eq('qb_customer_id', filters.customer);
      }
      if (filters.employee && filters.employee !== 'all') {
        query = query.eq('employee_name', filters.employee);
      }

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;
      setEntries(data || []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load time entries');
    } finally {
      setLoading(false);
    }
  }, [filters.startDate, filters.endDate, filters.customer, filters.employee]);

  useEffect(() => { load(); }, [load]);

  return { entries, loading, error, lastUpdated, reload: load };
}
