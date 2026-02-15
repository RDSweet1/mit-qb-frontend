'use client';

import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Clock } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { computeDateRange } from '@/lib/datePresets';
import { supabase, callEdgeFunction } from '@/lib/supabaseClient';
import type { TimeEntry, DatePreset, ReportPeriod } from '@/lib/types';
import { useMsal } from '@azure/msal-react';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { TrackingHistoryDialog } from '@/components/time-entries/TrackingHistoryDialog';
import { EnhanceNotesDialog } from '@/components/time-entries/EnhanceNotesDialog';
import { AssignClarificationDialog } from '@/components/time-entries/AssignClarificationDialog';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { useCustomers } from '@/lib/hooks/useCustomers';
import { useServiceItems } from '@/lib/hooks/useServiceItems';
import { DataTimestamp } from '@/components/DataTimestamp';
import { TimeEntryFilters } from '@/components/time-entries/TimeEntryFilters';
import { TimeEntryActionBar } from '@/components/time-entries/TimeEntryActionBar';
import { TimeEntryRow } from '@/components/time-entries/TimeEntryRow';
import { CustomerCard } from '@/components/time-entries/CustomerCard';
import { SendDialog } from '@/components/time-entries/SendDialog';
import { ChangeReasonDialog } from '@/components/time-entries/ChangeReasonDialog';
import { BatchServiceItemDialog } from '@/components/time-entries/BatchServiceItemDialog';
import toast from 'react-hot-toast';

export default function TimeEntriesEnhancedPage() {
  const { accounts } = useMsal();
  const user = accounts[0];

  // Shared data hooks
  const { customers } = useCustomers();
  const { serviceItems, descriptionMap: serviceItemDescriptions } = useServiceItems();

  // State
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Filters
  const [datePreset, setDatePreset] = useState<DatePreset>('last_month');
  const [startDate, setStartDate] = useState(format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'));
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'datetime' | 'employee' | 'costcode'>('datetime');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Test mode
  const [testMode, setTestMode] = useState(true);

  // Selection & approval
  const [selectedEntries, setSelectedEntries] = useState<Set<number>>(new Set());
  const [approvalStatusFilter, setApprovalStatusFilter] = useState<string>('all');
  const [approvingEntries, setApprovingEntries] = useState(false);

  // Dialog state
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyEntry, setHistoryEntry] = useState<TimeEntry | null>(null);
  const [enhanceDialogOpen, setEnhanceDialogOpen] = useState(false);
  const [enhancingEntry, setEnhancingEntry] = useState<TimeEntry | null>(null);
  const [clarifyDialogOpen, setClarifyDialogOpen] = useState(false);
  const [clarifyEntries, setClarifyEntries] = useState<TimeEntry[]>([]);
  const [changeReasonDialogOpen, setChangeReasonDialogOpen] = useState(false);
  const [changeReasonEntry, setChangeReasonEntry] = useState<TimeEntry | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendDialogEntryIds, setSendDialogEntryIds] = useState<number[]>([]);
  const [sendingFromDialog, setSendingFromDialog] = useState(false);

  // Inline editing state
  const [editingServiceItemId, setEditingServiceItemId] = useState<number | null>(null);
  const [editingBillableId, setEditingBillableId] = useState<number | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);

  // Batch service item dialog
  const [batchServiceItemOpen, setBatchServiceItemOpen] = useState(false);

  // Collapsed cards
  const [collapsedCards, setCollapsedCards] = useState<Set<string>>(new Set());

  // Report periods
  const [reportPeriods, setReportPeriods] = useState<ReportPeriod[]>([]);

  // ──────────────────────────────────────────────
  // Data loading
  // ──────────────────────────────────────────────

  const loadTimeEntries = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('time_entries')
        .select('*')
        .gte('txn_date', startDate)
        .lte('txn_date', endDate);

      if (selectedCustomer !== 'all') query = query.eq('qb_customer_id', selectedCustomer);
      if (selectedEmployee !== 'all') query = query.eq('employee_name', selectedEmployee);

      const { data, error } = await query;
      if (error) throw error;
      setEntries(data || []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load time entries');
    } finally {
      setLoading(false);
    }
  };

  const loadReportPeriods = async () => {
    const { data } = await supabase
      .from('report_periods')
      .select('*')
      .gte('week_end', startDate)
      .lte('week_start', endDate);
    setReportPeriods(data || []);
  };

  const getReportStatus = (entry: TimeEntry): ReportPeriod['status'] | null => {
    const match = reportPeriods.find(rp =>
      rp.qb_customer_id === entry.qb_customer_id &&
      entry.txn_date >= rp.week_start &&
      entry.txn_date <= rp.week_end
    );
    return match?.status ?? null;
  };

  // ──────────────────────────────────────────────
  // Sorting & grouping
  // ──────────────────────────────────────────────

  const sortedEntries = useMemo(() => {
    const sorted = [...entries].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'datetime':
          comparison = a.txn_date.localeCompare(b.txn_date);
          if (comparison === 0 && a.start_time && b.start_time)
            comparison = a.start_time.localeCompare(b.start_time);
          break;
        case 'employee':
          comparison = a.employee_name.localeCompare(b.employee_name);
          break;
        case 'costcode':
          comparison = (a.cost_code || '').localeCompare(b.cost_code || '');
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [entries, sortBy, sortDirection]);

  const groupedByCustomer = useMemo(() => {
    const groups = new Map<string, TimeEntry[]>();
    sortedEntries.forEach(entry => {
      const id = entry.qb_customer_id;
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id)!.push(entry);
    });
    return groups;
  }, [sortedEntries]);

  const uniqueEmployees = useMemo(() => {
    return Array.from(new Set(entries.map(e => e.employee_name))).sort();
  }, [entries]);

  const getFilteredAndSortedEntries = () => {
    let filtered = sortedEntries;
    if (approvalStatusFilter === 'not_sent') {
      filtered = filtered.filter(e => !e.approval_status || e.approval_status === 'pending' || e.approval_status === 'approved');
    } else if (approvalStatusFilter === 'edited') {
      filtered = filtered.filter(e => e.manually_edited || e.edit_count > 0);
    } else if (approvalStatusFilter !== 'all') {
      filtered = filtered.filter(e => e.approval_status === approvalStatusFilter);
    }
    return filtered;
  };

  const calculateTotalHours = (entries: TimeEntry[]) => {
    const totalMinutes = entries.reduce((sum, entry) => sum + (entry.hours * 60) + entry.minutes, 0);
    return (totalMinutes / 60).toFixed(1);
  };

  const parseLocalDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // ──────────────────────────────────────────────
  // Date preset handler
  // ──────────────────────────────────────────────

  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const { startDate: s, endDate: e } = computeDateRange(preset);
    setStartDate(s);
    setEndDate(e);
  };

  // ──────────────────────────────────────────────
  // QuickBooks sync
  // ──────────────────────────────────────────────

  const syncFromQuickBooks = async () => {
    try {
      setSyncing(true);
      setError(null);

      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/qb-time-sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ startDate, endDate, billableOnly: false }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const errorMessage = responseData.error || 'Sync failed';
        if (errorMessage.includes('invalid_client')) {
          setError('QuickBooks authentication failed. Client credentials may be incorrect. Check Edge Function logs in Supabase.');
        } else if (errorMessage.includes('Token refresh failed')) {
          setError(`Token refresh failed: ${errorMessage}`);
        } else {
          setError(`Sync failed: ${errorMessage}`);
        }
        return;
      }

      toast.success(`Synced ${responseData.synced} entries from ${responseData.customers} customers`);
      await loadTimeEntries();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync with QuickBooks';
      setError(`Fatal error: ${errorMessage}`);
    } finally {
      setSyncing(false);
    }
  };

  // ──────────────────────────────────────────────
  // CSV report generation
  // ──────────────────────────────────────────────

  const generateReport = () => {
    try {
      const headers = ['Date', 'Employee', 'Customer', 'Cost Code', 'Start Time', 'End Time', 'Hours', 'Billable', 'Status', 'Notes'];
      const rows = sortedEntries.map(entry => {
        const date = format(parseLocalDate(entry.txn_date), 'MM/dd/yyyy');
        const startTime = entry.start_time?.includes('T')
          ? format(new Date(entry.start_time), 'h:mm a')
          : entry.start_time ? format(new Date(`2000-01-01T${entry.start_time}`), 'h:mm a') : 'N/A';
        const endTime = entry.end_time?.includes('T')
          ? format(new Date(entry.end_time), 'h:mm a')
          : entry.end_time ? format(new Date(`2000-01-01T${entry.end_time}`), 'h:mm a') : 'N/A';
        return [date, entry.employee_name, entry.qb_customer_id, entry.cost_code, startTime, endTime,
          `${entry.hours}.${entry.minutes.toString().padStart(2, '0')}`, entry.billable_status,
          entry.approval_status, (entry.notes || '').replace(/"/g, '""')];
      });
      const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.setAttribute('href', URL.createObjectURL(blob));
      link.setAttribute('download', `time_entries_${startDate}_to_${endDate}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError('Failed to generate report: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  // ──────────────────────────────────────────────
  // Email / Send operations
  // ──────────────────────────────────────────────

  const sendEmailReport = async (recipient: string, recipientType: string, cc?: string[]) => {
    try {
      setError(null);
      const reportData = {
        startDate, endDate,
        entries: sortedEntries.map(entry => ({
          date: entry.txn_date, employee: entry.employee_name, customer: entry.qb_customer_id,
          costCode: entry.cost_code, hours: `${entry.hours}.${entry.minutes.toString().padStart(2, '0')}`,
          billable: entry.billable_status, description: entry.description,
        })),
        summary: { totalEntries: entries.length, totalHours: calculateTotalHours(entries) },
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/email_time_report`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: reportData, recipient, cc: cc || [], customerId: selectedCustomer !== 'all' ? selectedCustomer : undefined, entryIds: sortedEntries.map(e => e.id), sentBy: user?.username || 'system' }),
      });

      if (!response.ok) throw new Error(`Email failed: ${response.statusText}`);
      const result = await response.json();
      if (result.success) {
        const ccNote = cc?.length ? ` (CC: ${cc.join(', ')})` : '';
        toast.success(`Report emailed to ${recipientType}${ccNote}`);
      } else {
        throw new Error(result.error || 'Email sending failed');
      }
    } catch (err) {
      toast.error('Failed to email report: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const sendApprovedEntriesToCustomerWithOverride = async (entryIds: number[], toEmail: string, ccEmails: string[]) => {
    const { data: entriesToSend } = await supabase.from('time_entries').select('*').in('id', entryIds);
    if (!entriesToSend?.length) throw new Error('No entries found to send');

    const byCustomer = new Map<string, typeof entriesToSend>();
    entriesToSend.forEach(entry => {
      const custId = entry.qb_customer_id;
      if (!byCustomer.has(custId)) byCustomer.set(custId, []);
      byCustomer.get(custId)!.push(entry);
    });

    for (const [customerId, customerEntries] of byCustomer) {
      const reportData = {
        startDate, endDate,
        entries: customerEntries.map(entry => ({
          date: entry.txn_date, employee: entry.employee_name, customer: entry.qb_customer_id,
          costCode: entry.cost_code, hours: `${entry.hours}.${entry.minutes.toString().padStart(2, '0')}`,
          billable: entry.billable_status, description: entry.description,
        })),
        summary: { totalEntries: customerEntries.length, totalHours: calculateTotalHours(customerEntries) },
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/email_time_report`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: reportData, recipient: toEmail, cc: ccEmails, entryIds: customerEntries.map(e => e.id), customerId, sentBy: user?.username || 'system' }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Email failed (${response.status}): ${errText}`);
      }
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Email sending failed');

      await supabase.from('time_entries')
        .update({ approval_status: 'sent', sent_at: new Date().toISOString(), sent_to: toEmail })
        .in('id', customerEntries.map(e => e.id));
    }

    setEntries(prev => prev.map(e =>
      entryIds.includes(e.id) ? { ...e, approval_status: 'sent', sent_at: new Date().toISOString(), sent_to: toEmail } as TimeEntry : e
    ));
  };

  const sendApprovedEntriesToCustomer = async (entryIds: number[]) => {
    const { data: entriesToSend, error: fetchError } = await supabase.from('time_entries').select('*').in('id', entryIds);
    if (fetchError) throw fetchError;
    if (!entriesToSend?.length) return;

    const byCustomer = new Map<string, typeof entriesToSend>();
    entriesToSend.forEach(entry => {
      const custId = entry.qb_customer_id;
      if (!byCustomer.has(custId)) byCustomer.set(custId, []);
      byCustomer.get(custId)!.push(entry);
    });

    for (const [customerId, customerEntries] of byCustomer) {
      const customer = customers.find(c => c.qb_customer_id === customerId);
      if (!testMode && !customer?.email) continue;

      const recipient = testMode ? 'david@mitigationconsulting.com' : customer!.email!;
      const cc = testMode ? [] : ['skisner@mitigationconsulting.com', 'david@mitigationconsulting.com'];

      const reportData = {
        startDate, endDate,
        entries: customerEntries.map(entry => ({
          date: entry.txn_date, employee: entry.employee_name, customer: entry.qb_customer_id,
          costCode: entry.cost_code, hours: `${entry.hours}.${entry.minutes.toString().padStart(2, '0')}`,
          billable: entry.billable_status, description: entry.description,
        })),
        summary: { totalEntries: customerEntries.length, totalHours: calculateTotalHours(customerEntries) },
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/email_time_report`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: reportData, recipient, cc, entryIds: customerEntries.map(e => e.id), customerId, sentBy: user?.username || 'system' }),
      });

      if (response.ok) {
        await supabase.from('time_entries')
          .update({ approval_status: 'sent', sent_at: new Date().toISOString(), sent_to: recipient })
          .in('id', customerEntries.map(e => e.id));

        await supabase.from('approval_audit_log').insert(
          customerEntries.map(e => ({ time_entry_id: e.id, action: 'sent', performed_by: user?.username || 'system', performed_at: new Date().toISOString(), details: { recipient } }))
        );
      }
    }
  };

  const sendFromDialog = async (mode: 'test' | 'customer' | 'skip') => {
    if (mode === 'skip') {
      setSendDialogOpen(false);
      setSendDialogEntryIds([]);
      return;
    }
    setSendingFromDialog(true);
    try {
      if (mode === 'test') {
        await sendApprovedEntriesToCustomerWithOverride(sendDialogEntryIds, 'david@mitigationconsulting.com', ['skisner@mitigationconsulting.com']);
        toast.success('Test report sent to David & Sharon');
      } else {
        await sendApprovedEntriesToCustomer(sendDialogEntryIds);
        toast.success('Report sent to customer (CC: Sharon & David)');
      }
    } catch (err) {
      toast.error(`Send failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setSendingFromDialog(false);
      setSendDialogOpen(false);
      setSendDialogEntryIds([]);
    }
  };

  const sendReportToCustomer = () => {
    if (testMode) {
      sendEmailReport('david@mitigationconsulting.com', 'David (test mode)');
    } else {
      if (selectedCustomer === 'all') {
        toast.error('Please select a specific customer to email the report');
        return;
      }
      const customer = customers.find(c => c.qb_customer_id === selectedCustomer);
      if (!customer) { toast.error('Customer not found'); return; }
      if (!customer.email) { toast.error('Customer email not found. Please add customer email in QuickBooks.'); return; }
      sendEmailReport(customer.email, `Customer (${customer.display_name})`, ['skisner@mitigationconsulting.com', 'david@mitigationconsulting.com']);
    }
  };

  // ──────────────────────────────────────────────
  // Selection & approval
  // ──────────────────────────────────────────────

  const toggleEntrySelection = (entryId: number) => {
    setSelectedEntries(prev => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId); else next.add(entryId);
      return next;
    });
  };

  const handleSelectAllInCard = (_customerId: string, ids: number[], allSelected: boolean) => {
    setSelectedEntries(prev => {
      const next = new Set(prev);
      if (allSelected) { ids.forEach(id => next.delete(id)); }
      else { ids.forEach(id => next.add(id)); }
      return next;
    });
  };

  const approveSelectedEntries = async () => {
    if (selectedEntries.size === 0) { toast.error('No entries selected'); return; }
    try {
      setApprovingEntries(true);
      setError(null);
      const entryIds = Array.from(selectedEntries);
      const userEmail = user?.username || 'unknown';

      const { error: updateError } = await supabase.from('time_entries')
        .update({ approval_status: 'approved', approved_by: userEmail, approved_at: new Date().toISOString() })
        .in('id', entryIds).select();

      if (updateError) throw updateError;

      supabase.from('approval_audit_log').insert(
        entryIds.map(id => ({ time_entry_id: id, action: 'approved', performed_by: userEmail, performed_at: new Date().toISOString(), details: { method: 'bulk_approve' } }))
      );

      setEntries(prev => prev.map(e =>
        entryIds.includes(e.id) ? { ...e, approval_status: 'approved', approved_by: userEmail, approved_at: new Date().toISOString() } : e
      ));
      setSelectedEntries(new Set());
      toast.success(`Approved ${entryIds.length} entries`);

      setSendDialogEntryIds(entryIds);
      setSendDialogOpen(true);
    } catch (err) {
      toast.error(`Failed to approve entries: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setApprovingEntries(false);
    }
  };

  const approveAllEntries = async () => {
    const filteredEntries = getFilteredAndSortedEntries();
    const pendingEntries = filteredEntries.filter(e => e.approval_status === 'pending');
    if (pendingEntries.length === 0) { toast.error('No pending entries to approve'); return; }
    setSelectedEntries(new Set(pendingEntries.map(e => e.id)));
    // Note: approveSelectedEntries will be called on next render when selectedEntries updates
    // We need to call it directly with the pending IDs instead
    const entryIds = pendingEntries.map(e => e.id);
    const userEmail = user?.username || 'unknown';
    try {
      setApprovingEntries(true);
      const { error: updateError } = await supabase.from('time_entries')
        .update({ approval_status: 'approved', approved_by: userEmail, approved_at: new Date().toISOString() })
        .in('id', entryIds).select();
      if (updateError) throw updateError;

      setEntries(prev => prev.map(e =>
        entryIds.includes(e.id) ? { ...e, approval_status: 'approved', approved_by: userEmail, approved_at: new Date().toISOString() } : e
      ));
      setSelectedEntries(new Set());
      toast.success(`Approved ${entryIds.length} entries`);
      setSendDialogEntryIds(entryIds);
      setSendDialogOpen(true);
    } catch (err) {
      toast.error(`Failed to approve entries: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setApprovingEntries(false);
    }
  };

  // ──────────────────────────────────────────────
  // Inline editing (notes, service item, billable)
  // ──────────────────────────────────────────────

  const saveNotes = async (entryId: number, newNotes: string) => {
    const userEmail = user?.username || 'unknown';
    const entry = entries.find(e => e.id === entryId);
    const currentEditCount = entry?.edit_count || 0;

    setSavingNotes(true);
    try {
      const { error: updateError } = await supabase.from('time_entries')
        .update({ notes: newNotes, updated_at: new Date().toISOString(), updated_by: userEmail, manually_edited: true, edit_count: currentEditCount + 1 })
        .eq('id', entryId);
      if (updateError) throw updateError;

      setEntries(prev => prev.map(e => e.id === entryId
        ? { ...e, notes: newNotes, manually_edited: true, edit_count: currentEditCount + 1, updated_at: new Date().toISOString(), updated_by: userEmail }
        : e
      ));

      try {
        const qbResult = await callEdgeFunction('update_qb_time_entry', { entry_id: entryId, notes: newNotes, user_email: userEmail });
        if (!qbResult.success) console.warn('QB Time sync-back failed:', qbResult.error);
      } catch (qbErr) {
        console.warn('Could not sync notes back to QB Time:', qbErr);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save notes';
      setError(msg);
      throw err;
    } finally {
      setSavingNotes(false);
    }
  };

  const saveServiceItem = async (entryId: number, newQbItemId: string) => {
    const userEmail = user?.username || 'unknown';
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;
    const currentEditCount = entry.edit_count || 0;
    const selectedItem = serviceItems.find(si => si.qb_item_id === newQbItemId);
    if (!selectedItem) return;

    try {
      const { error: updateError } = await supabase.from('time_entries')
        .update({ qb_item_id: newQbItemId, service_item_name: selectedItem.name, cost_code: selectedItem.code || selectedItem.name, updated_at: new Date().toISOString(), updated_by: userEmail, manually_edited: true, edit_count: currentEditCount + 1 })
        .eq('id', entryId);
      if (updateError) throw updateError;

      setEntries(prev => prev.map(e => e.id === entryId
        ? { ...e, qb_item_id: newQbItemId, service_item_name: selectedItem.name, cost_code: selectedItem.code || selectedItem.name, manually_edited: true, edit_count: currentEditCount + 1, updated_at: new Date().toISOString(), updated_by: userEmail }
        : e
      ));

      try {
        const qbResult = await callEdgeFunction('update_qb_time_entry', { entry_id: entryId, qb_item_id: newQbItemId, user_email: userEmail });
        if (!qbResult.success) console.warn('QB Online sync-back failed:', qbResult.error);
      } catch (qbErr) {
        console.warn('Could not sync service item back to QB:', qbErr);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save service item');
    }
  };

  const saveBillableStatus = async (entryId: number, newStatus: string) => {
    const userEmail = user?.username || 'unknown';
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;
    const currentEditCount = entry.edit_count || 0;

    try {
      const { error: updateError } = await supabase.from('time_entries')
        .update({ billable_status: newStatus, updated_at: new Date().toISOString(), updated_by: userEmail, manually_edited: true, edit_count: currentEditCount + 1 })
        .eq('id', entryId);
      if (updateError) throw updateError;

      setEntries(prev => prev.map(e => e.id === entryId
        ? { ...e, billable_status: newStatus, manually_edited: true, edit_count: currentEditCount + 1, updated_at: new Date().toISOString(), updated_by: userEmail }
        : e
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save billable status');
    }
  };

  // ──────────────────────────────────────────────
  // Batch service item assignment
  // ──────────────────────────────────────────────

  const batchAssignServiceItem = async (qbItemId: string) => {
    const userEmail = user?.username || 'unknown';
    const selectedItem = serviceItems.find(si => si.qb_item_id === qbItemId);
    if (!selectedItem) return;

    const entryIds = Array.from(selectedEntries);
    try {
      const { error: updateError } = await supabase.from('time_entries')
        .update({
          qb_item_id: qbItemId,
          service_item_name: selectedItem.name,
          cost_code: selectedItem.code || selectedItem.name,
          updated_at: new Date().toISOString(),
          updated_by: userEmail,
          manually_edited: true,
        })
        .in('id', entryIds);
      if (updateError) throw updateError;

      setEntries(prev => prev.map(e =>
        entryIds.includes(e.id)
          ? { ...e, qb_item_id: qbItemId, service_item_name: selectedItem.name, cost_code: selectedItem.code || selectedItem.name, manually_edited: true, updated_at: new Date().toISOString(), updated_by: userEmail }
          : e
      ));
      toast.success(`Updated service item for ${entryIds.length} entries`);
      setBatchServiceItemOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update service items');
    }
  };

  // ──────────────────────────────────────────────
  // Approve & Send shortcut
  // ──────────────────────────────────────────────

  const approveAndSend = async () => {
    if (selectedEntries.size === 0) { toast.error('No entries selected'); return; }
    try {
      setApprovingEntries(true);
      const entryIds = Array.from(selectedEntries);
      const userEmail = user?.username || 'unknown';

      const { error: updateError } = await supabase.from('time_entries')
        .update({ approval_status: 'approved', approved_by: userEmail, approved_at: new Date().toISOString() })
        .in('id', entryIds).select();
      if (updateError) throw updateError;

      setEntries(prev => prev.map(e =>
        entryIds.includes(e.id) ? { ...e, approval_status: 'approved', approved_by: userEmail, approved_at: new Date().toISOString() } : e
      ));
      setSelectedEntries(new Set());
      toast.success(`Approved ${entryIds.length} entries`);

      // Immediately open send dialog
      setSendDialogEntryIds(entryIds);
      setSendDialogOpen(true);
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setApprovingEntries(false);
    }
  };

  // ──────────────────────────────────────────────
  // Lock/unlock
  // ──────────────────────────────────────────────

  const handleLockToggle = async (entry: TimeEntry) => {
    if (!user) return;
    const locking = !entry.is_locked;
    if (!locking && (entry.approval_status === 'sent' || entry.approval_status === 'accepted')) {
      setChangeReasonEntry(entry);
      setChangeReasonDialogOpen(true);
      return;
    }
    await performUnlock(entry);
  };

  const performUnlock = async (entry: TimeEntry, reason?: string) => {
    if (!user) return;
    try {
      const locking = !entry.is_locked;
      const functionName = locking ? 'lock_time_entry' : 'unlock_time_entry';
      const data = await callEdgeFunction(functionName, { entry_id: entry.id, user_email: user.username });
      if (!data.success) throw new Error(data.error || data.message);

      if (reason && (entry.approval_status === 'sent' || entry.approval_status === 'accepted')) {
        await supabase.from('time_entries')
          .update({ change_reason: reason, post_send_edit: true, amended_at: new Date().toISOString(), approval_status: 'amended' })
          .eq('id', entry.id);
      }

      const updatedFields: Partial<TimeEntry> = {
        is_locked: locking,
        unlocked_by: locking ? null : user.username,
        unlocked_at: locking ? null : new Date().toISOString(),
      };
      if (reason && (entry.approval_status === 'sent' || entry.approval_status === 'accepted')) {
        (updatedFields as any).approval_status = 'amended';
        (updatedFields as any).change_reason = reason;
        (updatedFields as any).post_send_edit = true;
      }

      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, ...updatedFields } : e));
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
    }
  };

  const handleChangeReasonSubmit = (entry: TimeEntry, reason: string) => {
    setChangeReasonDialogOpen(false);
    performUnlock(entry, reason);
  };

  // ──────────────────────────────────────────────
  // Card collapse
  // ──────────────────────────────────────────────

  const toggleCardCollapse = (customerId: string) => {
    setCollapsedCards(prev => {
      const next = new Set(prev);
      if (next.has(customerId)) next.delete(customerId); else next.add(customerId);
      return next;
    });
  };

  // ──────────────────────────────────────────────
  // Effects
  // ──────────────────────────────────────────────

  useEffect(() => {
    loadTimeEntries();
    loadReportPeriods();
  }, [startDate, endDate, selectedCustomer, selectedEmployee]);

  // ──────────────────────────────────────────────
  // Shared row props
  // ──────────────────────────────────────────────

  const rowProps = {
    onToggleSelection: toggleEntrySelection,
    onLockToggle: handleLockToggle,
    onHistoryClick: (entry: TimeEntry) => { setHistoryEntry(entry); setHistoryDialogOpen(true); },
    onEnhanceClick: (entry: TimeEntry) => { setEnhancingEntry(entry); setEnhanceDialogOpen(true); },
    onClarifyClick: (entries: TimeEntry[]) => { setClarifyEntries(entries); setClarifyDialogOpen(true); },
    onSaveNotes: saveNotes,
    onSaveServiceItem: saveServiceItem,
    onSaveBillableStatus: saveBillableStatus,
    savingNotes,
    serviceItems,
    serviceItemDescriptions,
    editingServiceItemId,
    editingBillableId,
    onSetEditingServiceItemId: setEditingServiceItemId,
    onSetEditingBillableId: setEditingBillableId,
    getReportStatus,
  };

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────

  return (
    <AppShell>
      <PageHeader
        title="Time Entries"
        subtitle="Production QuickBooks Data"
        icon={<Clock className="w-6 h-6 text-blue-600" />}
        actions={
          <div className="flex items-center gap-3">
            <DataTimestamp
              lastUpdated={lastUpdated}
              onRefresh={() => { loadTimeEntries(); loadReportPeriods(); }}
              isRefreshing={loading}
              autoRefreshInterval={300_000}
            />
            <button
              onClick={syncFromQuickBooks}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync from QB'}
            </button>
          </div>
        }
      />

      <TimeEntryFilters
        datePreset={datePreset}
        startDate={startDate}
        endDate={endDate}
        selectedCustomer={selectedCustomer}
        selectedEmployee={selectedEmployee}
        approvalStatusFilter={approvalStatusFilter}
        sortBy={sortBy}
        sortDirection={sortDirection}
        customers={customers}
        uniqueEmployees={uniqueEmployees}
        onDatePresetChange={handleDatePresetChange}
        onStartDateChange={(d) => { setStartDate(d); setDatePreset('custom'); }}
        onEndDateChange={(d) => { setEndDate(d); setDatePreset('custom'); }}
        onCustomerChange={setSelectedCustomer}
        onEmployeeChange={setSelectedEmployee}
        onApprovalStatusChange={setApprovalStatusFilter}
        onSortByChange={setSortBy}
        onSortDirectionToggle={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
      />

      {/* Error banner (real errors only) */}
      {error && (
        <div className="mb-6 border-2 rounded-lg p-6 shadow-lg bg-red-50 border-red-300">
          <div className="flex items-start gap-3">
            <div className="mt-1 text-red-600">&#9888;</div>
            <div className="flex-1">
              <h3 className="text-lg font-bold mb-2 text-red-900">Error</h3>
              <p className="whitespace-pre-wrap font-mono text-sm text-red-800">{error}</p>
              <p className="text-red-600 text-xs mt-3">Check browser console (F12) for detailed debug logs.</p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton variant="table" rows={8} columns={6} />
      ) : entries.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Time Entries Found</h3>
          <p className="text-gray-600 mb-6">No time entries found for the selected date range and filters.</p>
          <button onClick={syncFromQuickBooks} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <RefreshCw className="w-4 h-4" /> Sync from QuickBooks
          </button>
        </div>
      ) : (
        <>
          {entries.some(e => !e.is_locked) && (
            <div className="mb-4 bg-orange-50 border-l-4 border-orange-500 p-3 rounded-r-md">
              <p className="text-sm text-orange-800">
                <strong>{entries.filter(e => !e.is_locked).length} entries</strong> are unlocked and editable.
                Edits will sync back to QuickBooks Time when saved.
              </p>
            </div>
          )}

          <TimeEntryActionBar
            entries={entries}
            selectedEntries={selectedEntries}
            approvingEntries={approvingEntries}
            testMode={testMode}
            onApproveSelected={approveSelectedEntries}
            onApproveAll={approveAllEntries}
            onApproveAndSend={approveAndSend}
            onClarifySelected={() => {
              const selected = entries.filter(e => selectedEntries.has(e.id));
              setClarifyEntries(selected);
              setClarifyDialogOpen(true);
            }}
            onBatchServiceItem={() => setBatchServiceItemOpen(true)}
            onDeselectAll={() => setSelectedEntries(new Set())}
            onGenerateReport={generateReport}
            onToggleTestMode={() => setTestMode(t => !t)}
            onSendReport={sendReportToCustomer}
            selectedCustomer={selectedCustomer}
            calculateTotalHours={calculateTotalHours}
          />

          {/* Grouped by Customer or Flat List */}
          {selectedCustomer === 'all' ? (
            Array.from(groupedByCustomer.entries()).map(([customerId, customerEntries]) => (
              <CustomerCard
                key={customerId}
                customerId={customerId}
                customerName={customers.find(c => c.qb_customer_id === customerId)?.display_name || customerId}
                entries={customerEntries}
                selectedEntries={selectedEntries}
                isCollapsed={collapsedCards.has(customerId)}
                onToggleCollapse={toggleCardCollapse}
                onSelectAllInCard={handleSelectAllInCard}
                calculateTotalHours={calculateTotalHours}
                startDate={startDate}
                endDate={endDate}
                {...rowProps}
              />
            ))
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="divide-y divide-gray-200">
                {sortedEntries.map(entry => (
                  <TimeEntryRow
                    key={entry.id}
                    entry={entry}
                    isSelected={selectedEntries.has(entry.id)}
                    {...rowProps}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <TrackingHistoryDialog
        isOpen={historyDialogOpen}
        entryId={historyEntry?.id || null}
        entryDetails={historyEntry ? { employee_name: historyEntry.employee_name, txn_date: historyEntry.txn_date, hours: historyEntry.hours, minutes: historyEntry.minutes } : undefined}
        onClose={() => { setHistoryDialogOpen(false); setHistoryEntry(null); }}
      />

      <EnhanceNotesDialog
        isOpen={enhanceDialogOpen}
        entry={enhancingEntry}
        onAccept={saveNotes}
        onClose={() => { setEnhanceDialogOpen(false); setEnhancingEntry(null); }}
      />

      <SendDialog
        isOpen={sendDialogOpen}
        entryCount={sendDialogEntryIds.length}
        sending={sendingFromDialog}
        onSend={sendFromDialog}
      />

      <ChangeReasonDialog
        isOpen={changeReasonDialogOpen}
        entry={changeReasonEntry}
        onSubmit={handleChangeReasonSubmit}
        onClose={() => setChangeReasonDialogOpen(false)}
      />

      <BatchServiceItemDialog
        isOpen={batchServiceItemOpen}
        entryCount={selectedEntries.size}
        serviceItems={serviceItems}
        onAssign={batchAssignServiceItem}
        onClose={() => setBatchServiceItemOpen(false)}
      />

      <AssignClarificationDialog
        isOpen={clarifyDialogOpen}
        entries={clarifyEntries}
        adminEmail={user?.username || ''}
        onClose={() => { setClarifyDialogOpen(false); setClarifyEntries([]); }}
        onAssigned={() => { loadTimeEntries(); setSelectedEntries(new Set()); }}
      />
    </AppShell>
  );
}
