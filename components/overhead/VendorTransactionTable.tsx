'use client';

import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight, Loader2, Search } from 'lucide-react';
import { supabase, callEdgeFunction } from '@/lib/supabaseClient';
import { fmtMoney as _fmtMoney } from '@/lib/utils';

const fmtMoney = (n: number) => _fmtMoney(n, 2);

interface Transaction {
  id: number;
  txn_date: string;
  txn_type: string | null;
  txn_num: string | null;
  vendor_name: string | null;
  memo: string | null;
  qb_account_name: string | null;
  amount: number;
  category: string | null;
  category_source: string;
  is_overhead: boolean;
}

interface VendorGroup {
  vendor_name: string;
  transactions: Transaction[];
  total: number;
  category: string | null;
  is_overhead: boolean;
  hasMapping: boolean;
}

function fmtDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

interface VendorTransactionTableProps {
  categories: string[];
  refreshKey: number;
}

export default function VendorTransactionTable({ categories, refreshKey }: VendorTransactionTableProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [vendorMappings, setVendorMappings] = useState<Record<string, { category: string; is_overhead: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const [txnResult, mappingResult] = await Promise.all([
      supabase
        .from('overhead_transactions')
        .select('*')
        .order('vendor_name', { ascending: true })
        .order('txn_date', { ascending: false }),
      supabase
        .from('overhead_vendor_mappings')
        .select('*'),
    ]);

    if (txnResult.data) setTransactions(txnResult.data);
    if (mappingResult.data) {
      const map: Record<string, { category: string; is_overhead: boolean }> = {};
      for (const m of mappingResult.data) {
        map[m.vendor_name.toLowerCase()] = { category: m.category, is_overhead: m.is_overhead };
      }
      setVendorMappings(map);
    }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [refreshKey]);

  // Group transactions by vendor
  const vendorGroups = useMemo(() => {
    const groups: Record<string, VendorGroup> = {};
    for (const txn of transactions) {
      const key = txn.vendor_name || '(No Vendor)';
      if (!groups[key]) {
        const mapping = vendorMappings[key.toLowerCase()];
        groups[key] = {
          vendor_name: key,
          transactions: [],
          total: 0,
          category: mapping?.category || txn.category,
          is_overhead: mapping?.is_overhead ?? txn.is_overhead,
          hasMapping: !!mapping,
        };
      }
      groups[key].transactions.push(txn);
      groups[key].total += Number(txn.amount);
    }

    // Sort by total descending
    return Object.values(groups).sort((a, b) => b.total - a.total);
  }, [transactions, vendorMappings]);

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return vendorGroups;
    const q = search.toLowerCase();
    return vendorGroups.filter(g =>
      g.vendor_name.toLowerCase().includes(q) ||
      g.category?.toLowerCase().includes(q) ||
      g.transactions.some(t => t.memo?.toLowerCase().includes(q) || t.qb_account_name?.toLowerCase().includes(q))
    );
  }, [vendorGroups, search]);

  // Summary stats
  const stats = useMemo(() => {
    const overheadTotal = vendorGroups
      .filter(g => g.is_overhead)
      .reduce((s, g) => s + g.total, 0);
    return {
      vendorCount: vendorGroups.length,
      txnCount: transactions.length,
      annualTotal: overheadTotal,
      weeklyTotal: overheadTotal / 52,
    };
  }, [vendorGroups, transactions]);

  async function handleVendorCategoryChange(vendorName: string, newCategory: string | null, newIsOverhead: boolean) {
    setSaving(vendorName);
    try {
      // Upsert vendor mapping
      const { error: mapErr } = await supabase
        .from('overhead_vendor_mappings')
        .upsert({
          vendor_name: vendorName,
          category: newCategory || 'Uncategorized',
          is_overhead: newIsOverhead,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'vendor_name' });

      if (mapErr) {
        console.error('Failed to update vendor mapping:', mapErr);
        return;
      }

      // Update all non-overridden transactions for this vendor
      const { error: txnErr } = await supabase
        .from('overhead_transactions')
        .update({
          category: newCategory || 'Uncategorized',
          category_source: 'vendor',
          is_overhead: newIsOverhead,
        })
        .eq('vendor_name', vendorName)
        .neq('category_source', 'override');

      if (txnErr) {
        console.error('Failed to update transactions:', txnErr);
      }

      // Re-materialize
      await callEdgeFunction('sync-overhead-transactions', { materializeOnly: true });

      // Reload data
      await loadData();
    } finally {
      setSaving(null);
    }
  }

  async function handleTransactionOverride(txnId: number, newCategory: string | null, newIsOverhead: boolean) {
    setSaving(`txn-${txnId}`);
    try {
      const { error } = await supabase
        .from('overhead_transactions')
        .update({
          category: newCategory || 'Uncategorized',
          category_source: 'override',
          is_overhead: newIsOverhead,
        })
        .eq('id', txnId);

      if (error) {
        console.error('Failed to override transaction:', error);
        return;
      }

      // Re-materialize
      await callEdgeFunction('sync-overhead-transactions', { materializeOnly: true });

      // Reload data
      await loadData();
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-sm">No transactions synced yet. Click "Sync from QuickBooks" to pull expense data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <span className="text-xs text-gray-500 uppercase">Annual Overhead</span>
          <p className="text-lg font-bold text-gray-900">{fmtMoney(stats.annualTotal)}</p>
        </div>
        <div>
          <span className="text-xs text-gray-500 uppercase">Weekly (/52)</span>
          <p className="text-lg font-bold text-teal-700">{fmtMoney(stats.weeklyTotal)}</p>
        </div>
        <div>
          <span className="text-xs text-gray-500 uppercase">Vendors</span>
          <p className="text-lg font-bold text-gray-700">{stats.vendorCount}</p>
        </div>
        <div>
          <span className="text-xs text-gray-500 uppercase">Transactions</span>
          <p className="text-lg font-bold text-gray-700">{stats.txnCount}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search vendors, categories, memos..."
          className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
        />
      </div>

      {/* Vendor Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Vendor</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Txns</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Total</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Category</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Overhead?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(group => {
                const isExpanded = expandedVendor === group.vendor_name;
                return (
                  <VendorRow
                    key={group.vendor_name}
                    group={group}
                    isExpanded={isExpanded}
                    onToggle={() => setExpandedVendor(isExpanded ? null : group.vendor_name)}
                    categories={categories}
                    saving={saving}
                    onVendorCategoryChange={handleVendorCategoryChange}
                    onTransactionOverride={handleTransactionOverride}
                  />
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200 font-semibold">
                <td className="px-4 py-3" colSpan={2}>
                  <span className="text-sm text-gray-900">{filtered.length} vendors</span>
                </td>
                <td className="px-4 py-3 text-center text-sm text-gray-700">
                  {filtered.reduce((s, g) => s + g.transactions.length, 0)}
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-900 tabular-nums">
                  {fmtMoney(filtered.reduce((s, g) => s + g.total, 0))}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// Sub-component: vendor row with expandable transactions
function VendorRow({
  group,
  isExpanded,
  onToggle,
  categories,
  saving,
  onVendorCategoryChange,
  onTransactionOverride,
}: {
  group: VendorGroup;
  isExpanded: boolean;
  onToggle: () => void;
  categories: string[];
  saving: string | null;
  onVendorCategoryChange: (vendor: string, category: string | null, isOverhead: boolean) => void;
  onTransactionOverride: (txnId: number, category: string | null, isOverhead: boolean) => void;
}) {
  const isSaving = saving === group.vendor_name;

  return (
    <>
      <tr className={`hover:bg-gray-50 cursor-pointer ${!group.is_overhead ? 'opacity-50' : ''}`}>
        <td className="px-4 py-2.5" onClick={onToggle}>
          {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </td>
        <td className="px-4 py-2.5 text-sm font-medium text-gray-900" onClick={onToggle}>
          {group.vendor_name}
          {group.hasMapping && (
            <span className="ml-2 text-[10px] font-medium text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">mapped</span>
          )}
        </td>
        <td className="px-4 py-2.5 text-sm text-gray-600 text-center" onClick={onToggle}>
          {group.transactions.length}
        </td>
        <td className="px-4 py-2.5 text-sm text-gray-900 text-right tabular-nums font-medium" onClick={onToggle}>
          {fmtMoney(group.total)}
        </td>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-1">
            <select
              value={group.category || ''}
              onChange={e => {
                const val = e.target.value;
                if (val === '__not_overhead__') {
                  onVendorCategoryChange(group.vendor_name, group.category, false);
                } else {
                  onVendorCategoryChange(group.vendor_name, val || null, true);
                }
              }}
              className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 max-w-[160px]"
              disabled={isSaving}
            >
              <option value="">Uncategorized</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
              <option value="__not_overhead__">--- Not Overhead ---</option>
            </select>
            {isSaving && <Loader2 className="w-3 h-3 animate-spin text-teal-600" />}
          </div>
        </td>
        <td className="px-4 py-2.5 text-center">
          <input
            type="checkbox"
            checked={group.is_overhead}
            onChange={e => onVendorCategoryChange(group.vendor_name, group.category, e.target.checked)}
            className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
            disabled={isSaving}
          />
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={6} className="bg-gray-50 px-4 py-2">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-semibold text-gray-500 uppercase">
                  <th className="py-1 text-left pl-8">Date</th>
                  <th className="py-1 text-left">Type</th>
                  <th className="py-1 text-left">Memo</th>
                  <th className="py-1 text-left">QB Account</th>
                  <th className="py-1 text-right">Amount</th>
                  <th className="py-1 text-left pl-2">Category</th>
                  <th className="py-1 text-center">OH?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {group.transactions.map(txn => {
                  const txnSaving = saving === `txn-${txn.id}`;
                  return (
                    <tr key={txn.id} className="hover:bg-gray-100 text-xs">
                      <td className="py-1.5 text-gray-700 pl-8">{fmtDate(txn.txn_date)}</td>
                      <td className="py-1.5 text-gray-600">{txn.txn_type || '\u2014'}</td>
                      <td className="py-1.5 text-gray-600 max-w-[200px] truncate" title={txn.memo || ''}>
                        {txn.memo || '\u2014'}
                      </td>
                      <td className="py-1.5 text-gray-600 max-w-[150px] truncate" title={txn.qb_account_name || ''}>
                        {txn.qb_account_name || '\u2014'}
                      </td>
                      <td className="py-1.5 text-gray-900 text-right tabular-nums font-medium">
                        {fmtMoney(Number(txn.amount))}
                      </td>
                      <td className="py-1.5 pl-2">
                        <div className="flex items-center gap-1">
                          <select
                            value={txn.category || ''}
                            onChange={e => {
                              const val = e.target.value;
                              if (val === '__not_overhead__') {
                                onTransactionOverride(txn.id, txn.category, false);
                              } else {
                                onTransactionOverride(txn.id, val || null, true);
                              }
                            }}
                            className={`text-xs border rounded px-1 py-0.5 max-w-[120px] ${
                              txn.category_source === 'override'
                                ? 'border-amber-300 bg-amber-50'
                                : 'border-gray-300'
                            }`}
                            disabled={txnSaving}
                          >
                            <option value="">Uncategorized</option>
                            {categories.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                            <option value="__not_overhead__">--- Not Overhead ---</option>
                          </select>
                          {txn.category_source === 'override' && (
                            <span className="text-[9px] font-medium text-amber-600">OVR</span>
                          )}
                          {txnSaving && <Loader2 className="w-3 h-3 animate-spin text-teal-600" />}
                        </div>
                      </td>
                      <td className="py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={txn.is_overhead}
                          onChange={e => onTransactionOverride(txn.id, txn.category, e.target.checked)}
                          className="w-3 h-3 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                          disabled={txnSaving}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}
