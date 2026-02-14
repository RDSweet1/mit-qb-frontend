import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Customer } from '@/lib/types';

interface UseCustomersResult {
  customers: Customer[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useCustomers(activeOnly = true): UseCustomersResult {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      let query = supabase
        .from('customers')
        .select('qb_customer_id, display_name, email')
        .order('display_name');

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;
      setCustomers(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [activeOnly]);

  useEffect(() => { load(); }, [load]);

  return { customers, loading, error, reload: load };
}
