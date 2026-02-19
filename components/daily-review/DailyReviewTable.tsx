'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Loader2, Search, Check, Flag, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { fmtMoney as _fmtMoney } from '@/lib/utils';
import type { DailyReviewTransaction } from '@/lib/types';

const fmtMoney = (n: number) => _fmtMoney(n, 2);

function fmtDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending:       { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'Pending' },
  reviewed:      { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Reviewed' },
  auto_approved: { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Auto' },
  flagged:       { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Flagged' },
};

const TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  Purchase: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  Bill:     { bg: 'bg-violet-100', text: 'text-violet-700' },
  Payment:  { bg: 'bg-green-100',  text: 'text-green-700' },
  Deposit:  { bg: 'bg-teal-100',   text: 'text-teal-700' },
};

interface DailyReviewTableProps {
  transactions: DailyReviewTransaction[];
  categories: string[];
  statusFilter: string;
  accountFilter: string;
  searchQuery: string;
  userEmail: string;
  onRefresh: () => void;
}

export default function DailyReviewTable({
  transactions,
  categories,
  statusFilter,
  accountFilter,
  searchQuery,
  userEmail,
  onRefresh,
}: DailyReviewTableProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState<number | null>(null);
  const [batchSaving, setBatchSaving] = useState(false);
  const [editingMemo, setEditingMemo] = useState<{ id: number; value: string } | null>(null);

  // Filter transactions
  const filtered = useMemo(() => {
    let result = transactions;

    if (statusFilter && statusFilter !== 'all') {
      result = result.filter(t => t.review_status === statusFilter);
    }
    if (accountFilter && accountFilter !== 'all') {
      result = result.filter(t => t.qb_account_name === accountFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.vendor_name?.toLowerCase().includes(q) ||
        t.customer_name?.toLowerCase().includes(q) ||
        t.memo?.toLowerCase().includes(q) ||
        t.qb_account_name?.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [transactions, statusFilter, accountFilter, searchQuery]);

  // Unique accounts for display
  const accountNames = useMemo(() => {
    const names = new Set<string>();
    for (const t of transactions) {
      if (t.qb_account_name) names.add(t.qb_account_name);
    }
    return Array.from(names).sort();
  }, [transactions]);

  // Toggle select
  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(t => t.id)));
    }
  }

  // Update a single transaction field
  async function updateTransaction(id: number, updates: Partial<DailyReviewTransaction>) {
    setSaving(id);
    try {
      const { error } = await supabase
        .from('daily_review_transactions')
        .update(updates)
        .eq('id', id);

      if (error) {
        console.error('Failed to update transaction:', error);
        return;
      }

      // Log audit
      const changes: Record<string, any> = {};
      const txn = transactions.find(t => t.id === id);
      for (const [key, value] of Object.entries(updates)) {
        changes[key] = { old: txn?.[key as keyof DailyReviewTransaction], new: value };
      }

      await supabase.from('daily_review_audit_log').insert({
        transaction_id: id,
        action: Object.keys(updates).includes('review_status') ? 'reviewed' :
                Object.keys(updates).includes('category') ? 'category_changed' :
                'memo_updated',
        user_email: userEmail,
        changes,
      });

      onRefresh();
    } finally {
      setSaving(null);
    }
  }

  // Mark as reviewed
  async function markReviewed(id: number) {
    await updateTransaction(id, {
      review_status: 'reviewed',
      reviewed_by: userEmail,
      reviewed_at: new Date().toISOString(),
    } as any);
  }

  // Flag for review
  async function flagTransaction(id: number) {
    await updateTransaction(id, {
      review_status: 'flagged',
      reviewed_by: userEmail,
      reviewed_at: new Date().toISOString(),
    } as any);
  }

  // Batch mark reviewed
  async function batchMarkReviewed() {
    setBatchSaving(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase
        .from('daily_review_transactions')
        .update({
          review_status: 'reviewed',
          reviewed_by: userEmail,
          reviewed_at: new Date().toISOString(),
        })
        .in('id', ids);

      if (error) {
        console.error('Batch review failed:', error);
        return;
      }

      // Bulk audit log
      const auditRows = ids.map(id => ({
        transaction_id: id,
        action: 'reviewed',
        user_email: userEmail,
        changes: { review_status: { old: 'pending', new: 'reviewed' } },
      }));
      await supabase.from('daily_review_audit_log').insert(auditRows);

      setSelectedIds(new Set());
      onRefresh();
    } finally {
      setBatchSaving(false);
    }
  }

  // Batch set category
  async function batchSetCategory(category: string) {
    setBatchSaving(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase
        .from('daily_review_transactions')
        .update({
          category,
          category_source: 'manual',
        })
        .in('id', ids);

      if (error) {
        console.error('Batch category update failed:', error);
        return;
      }

      const auditRows = ids.map(id => ({
        transaction_id: id,
        action: 'category_changed',
        user_email: userEmail,
        changes: { category: { old: null, new: category } },
      }));
      await supabase.from('daily_review_audit_log').insert(auditRows);

      setSelectedIds(new Set());
      onRefresh();
    } finally {
      setBatchSaving(false);
    }
  }

  // Batch flag
  async function batchFlag() {
    setBatchSaving(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase
        .from('daily_review_transactions')
        .update({
          review_status: 'flagged',
          reviewed_by: userEmail,
          reviewed_at: new Date().toISOString(),
        })
        .in('id', ids);

      if (error) {
        console.error('Batch flag failed:', error);
        return;
      }

      setSelectedIds(new Set());
      onRefresh();
    } finally {
      setBatchSaving(false);
    }
  }

  // Save memo edit
  async function saveMemo(id: number, memo: string) {
    await updateTransaction(id, { memo } as any);
    setEditingMemo(null);
  }

  // Category change handler
  async function handleCategoryChange(id: number, category: string) {
    await updateTransaction(id, {
      category: category || null,
      category_source: 'manual',
    } as any);
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-sm">
          {transactions.length === 0
            ? 'No transactions synced yet. Click "Sync from QB" to pull expense data.'
            : 'No transactions match your filters.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Batch action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-lg px-4 py-2">
          <span className="text-sm font-medium text-teal-800">
            {selectedIds.size} selected
          </span>
          <button
            onClick={batchMarkReviewed}
            disabled={batchSaving}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {batchSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            Mark Reviewed ({selectedIds.size})
          </button>
          <select
            onChange={e => { if (e.target.value) batchSetCategory(e.target.value); e.target.value = ''; }}
            className="text-sm border border-gray-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-teal-500"
            disabled={batchSaving}
            defaultValue=""
          >
            <option value="" disabled>Set Category...</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <button
            onClick={batchFlag}
            disabled={batchSaving}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            <Flag className="w-3 h-3" />
            Flag
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-sm text-gray-600 hover:text-gray-800"
          >
            Clear
          </button>
        </div>
      )}

      {/* Transaction table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                  />
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Account</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Vendor</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Memo</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Amount</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Category</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-3 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(txn => {
                const isExpanded = expandedId === txn.id;
                const isSaving = saving === txn.id;
                const statusStyle = STATUS_STYLES[txn.review_status] || STATUS_STYLES.pending;
                const typeStyle = TYPE_STYLES[txn.qb_entity_type] || TYPE_STYLES.Purchase;
                const isEditingMemo = editingMemo?.id === txn.id;

                return (
                  <TransactionRow
                    key={txn.id}
                    txn={txn}
                    isExpanded={isExpanded}
                    isSelected={selectedIds.has(txn.id)}
                    isSaving={isSaving}
                    statusStyle={statusStyle}
                    typeStyle={typeStyle}
                    categories={categories}
                    isEditingMemo={isEditingMemo}
                    editingMemoValue={isEditingMemo ? editingMemo.value : ''}
                    onToggleExpand={() => setExpandedId(isExpanded ? null : txn.id)}
                    onToggleSelect={() => toggleSelect(txn.id)}
                    onMarkReviewed={() => markReviewed(txn.id)}
                    onFlag={() => flagTransaction(txn.id)}
                    onCategoryChange={(cat) => handleCategoryChange(txn.id, cat)}
                    onStartEditMemo={() => setEditingMemo({ id: txn.id, value: txn.memo || '' })}
                    onChangeMemo={(val) => setEditingMemo({ id: txn.id, value: val })}
                    onSaveMemo={() => saveMemo(txn.id, editingMemo?.value || '')}
                    onCancelMemo={() => setEditingMemo(null)}
                  />
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200 font-semibold">
                <td className="px-3 py-3" colSpan={6}>
                  <span className="text-sm text-gray-700">{filtered.length} transactions</span>
                </td>
                <td className="px-3 py-3 text-right text-sm text-gray-900 tabular-nums">
                  {fmtMoney(filtered.reduce((s, t) => s + Number(t.total_amount), 0))}
                </td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// Sub-component: individual transaction row
function TransactionRow({
  txn,
  isExpanded,
  isSelected,
  isSaving,
  statusStyle,
  typeStyle,
  categories,
  isEditingMemo,
  editingMemoValue,
  onToggleExpand,
  onToggleSelect,
  onMarkReviewed,
  onFlag,
  onCategoryChange,
  onStartEditMemo,
  onChangeMemo,
  onSaveMemo,
  onCancelMemo,
}: {
  txn: DailyReviewTransaction;
  isExpanded: boolean;
  isSelected: boolean;
  isSaving: boolean;
  statusStyle: { bg: string; text: string; label: string };
  typeStyle: { bg: string; text: string };
  categories: string[];
  isEditingMemo: boolean;
  editingMemoValue: string;
  onToggleExpand: () => void;
  onToggleSelect: () => void;
  onMarkReviewed: () => void;
  onFlag: () => void;
  onCategoryChange: (cat: string) => void;
  onStartEditMemo: () => void;
  onChangeMemo: (val: string) => void;
  onSaveMemo: () => void;
  onCancelMemo: () => void;
}) {
  return (
    <>
      <tr className={`hover:bg-gray-50 ${isSelected ? 'bg-teal-50' : ''}`}>
        <td className="px-3 py-2.5">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
          />
        </td>
        <td className="px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap">
          {fmtDate(txn.txn_date)}
        </td>
        <td className="px-3 py-2.5">
          <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full ${typeStyle.bg} ${typeStyle.text}`}>
            {txn.qb_entity_type}
          </span>
        </td>
        <td className="px-3 py-2.5 text-sm text-gray-600 max-w-[120px] truncate" title={txn.qb_account_name || ''}>
          {txn.qb_account_name || '\u2014'}
        </td>
        <td className="px-3 py-2.5 text-sm font-medium text-gray-900 max-w-[150px] truncate" title={txn.vendor_name || ''}>
          {txn.vendor_name || txn.customer_name || '\u2014'}
        </td>
        <td className="px-3 py-2.5 text-sm text-gray-600 max-w-[180px]">
          {isEditingMemo ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={editingMemoValue}
                onChange={e => onChangeMemo(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') onSaveMemo();
                  if (e.key === 'Escape') onCancelMemo();
                }}
                className="text-sm border border-teal-300 rounded px-1.5 py-0.5 w-full focus:ring-2 focus:ring-teal-500"
                autoFocus
              />
              <button onClick={onSaveMemo} className="p-0.5 text-green-600 hover:text-green-800"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={onCancelMemo} className="p-0.5 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <span
              className="cursor-pointer hover:text-teal-700 truncate block"
              onClick={onStartEditMemo}
              title={txn.memo || 'Click to add memo'}
            >
              {txn.memo || <span className="text-gray-400 italic">No memo</span>}
            </span>
          )}
        </td>
        <td className="px-3 py-2.5 text-sm text-gray-900 text-right tabular-nums font-medium whitespace-nowrap">
          {fmtMoney(Number(txn.total_amount))}
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1">
            <select
              value={txn.category || ''}
              onChange={e => onCategoryChange(e.target.value)}
              className={`text-xs border rounded px-1.5 py-1 max-w-[130px] focus:ring-2 focus:ring-teal-500 ${
                txn.category_source === 'manual' ? 'border-teal-300 bg-teal-50' :
                txn.category_source === 'vendor' ? 'border-blue-300 bg-blue-50' :
                'border-gray-300'
              }`}
              disabled={isSaving}
            >
              <option value="">Uncategorized</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            {isSaving && <Loader2 className="w-3 h-3 animate-spin text-teal-600" />}
          </div>
        </td>
        <td className="px-3 py-2.5 text-center">
          <button
            onClick={() => {
              if (txn.review_status === 'pending') onMarkReviewed();
              else if (txn.review_status === 'flagged') onMarkReviewed();
              else onFlag();
            }}
            disabled={isSaving}
            className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full cursor-pointer hover:opacity-80 transition-opacity ${statusStyle.bg} ${statusStyle.text}`}
            title={txn.review_status === 'pending' ? 'Click to mark reviewed' : txn.review_status === 'reviewed' ? 'Click to flag' : 'Click to mark reviewed'}
          >
            {statusStyle.label}
          </button>
        </td>
        <td className="px-3 py-2.5">
          <button onClick={onToggleExpand} className="p-1 hover:bg-gray-100 rounded">
            {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          </button>
        </td>
      </tr>

      {/* Expanded line items */}
      {isExpanded && txn.line_items && txn.line_items.length > 0 && (
        <tr>
          <td colSpan={10} className="bg-gray-50 px-6 py-3">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Line Items</div>
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-semibold text-gray-500 uppercase">
                  <th className="py-1 text-left">#</th>
                  <th className="py-1 text-left">Type</th>
                  <th className="py-1 text-left">Account</th>
                  <th className="py-1 text-left">Customer/Job</th>
                  <th className="py-1 text-left">Description</th>
                  <th className="py-1 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {txn.line_items.map((line, i) => (
                  <tr key={line.Id || i} className="text-xs hover:bg-gray-100">
                    <td className="py-1.5 text-gray-500">{line.LineNum || i + 1}</td>
                    <td className="py-1.5 text-gray-600">{line.DetailType}</td>
                    <td className="py-1.5 text-gray-700">{line.AccountRef?.name || '\u2014'}</td>
                    <td className="py-1.5 text-gray-700">{line.CustomerRef?.name || '\u2014'}</td>
                    <td className="py-1.5 text-gray-600 max-w-[250px] truncate" title={line.Description || ''}>
                      {line.Description || '\u2014'}
                    </td>
                    <td className="py-1.5 text-gray-900 text-right tabular-nums font-medium">
                      {fmtMoney(Number(line.Amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}
