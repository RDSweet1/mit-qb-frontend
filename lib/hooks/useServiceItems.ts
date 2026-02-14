import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface ServiceItemOption {
  qb_item_id: string;
  name: string;
  code: string;
}

interface UseServiceItemsResult {
  serviceItems: ServiceItemOption[];
  /** Map of code/name → description for display purposes */
  descriptionMap: Record<string, string>;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useServiceItems(activeOnly = true): UseServiceItemsResult {
  const [raw, setRaw] = useState<Array<{ qb_item_id: string; code: string; name: string; description: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      let query = supabase
        .from('service_items')
        .select('qb_item_id, code, name, description')
        .order('name');

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;
      setRaw(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load service items');
    } finally {
      setLoading(false);
    }
  }, [activeOnly]);

  useEffect(() => { load(); }, [load]);

  const serviceItems = useMemo(
    () => raw.map(item => ({ qb_item_id: item.qb_item_id, name: item.name, code: item.code })),
    [raw]
  );

  const descriptionMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of raw) {
      if (item.code) map[item.code] = item.description || item.name || '';
      if (item.name) map[item.name] = item.description || item.name || '';
    }
    return map;
  }, [raw]);

  return { serviceItems, descriptionMap, loading, error, reload: load };
}
