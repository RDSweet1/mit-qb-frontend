'use client';

import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Calendar, Clock, User, Building2, FileText, Download, Mail, ArrowUp, ArrowDown, CheckCircle, X, History, Sparkles, ChevronDown, ChevronRight, Send, MessageSquare } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns';
import { supabase, callEdgeFunction } from '@/lib/supabaseClient';
import type { TimeEntry, Customer, ServiceItem, DatePreset, ReportPeriod } from '@/lib/types';
import { useMsal } from '@azure/msal-react';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { LockIcon } from '@/components/time-entries/LockIcon';
import { UnlockWarningDialog } from '@/components/time-entries/UnlockWarningDialog';
import { EditWarningBanner } from '@/components/time-entries/EditWarningBanner';
import { TrackingHistoryDialog } from '@/components/time-entries/TrackingHistoryDialog';
import { InlineNotesEditor } from '@/components/time-entries/InlineNotesEditor';
import { EnhanceNotesDialog } from '@/components/time-entries/EnhanceNotesDialog';
import { AssignClarificationDialog } from '@/components/time-entries/AssignClarificationDialog';

export default function TimeEntriesEnhancedPage() {
  const { accounts } = useMsal();
  const user = accounts[0];

  // State
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters - Default to last month for focused timesheet view
  const [datePreset, setDatePreset] = useState<DatePreset>('last_month');
  const [startDate, setStartDate] = useState(format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'));
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'datetime' | 'employee' | 'costcode'>('datetime');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc'); // desc = newest first

  // Test mode: when ON, all emails go to David only; when OFF, emails go to customer with CC to Sharon + David
  const [testMode, setTestMode] = useState(true);

  // Lock/Unlock state
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null);
  const [isLockingAction, setIsLockingAction] = useState(false);

  // Post-send edit: change reason dialog
  const [changeReasonDialogOpen, setChangeReasonDialogOpen] = useState(false);
  const [changeReasonEntry, setChangeReasonEntry] = useState<TimeEntry | null>(null);
  const [changeReason, setChangeReason] = useState('');
  const [changeReasonCustom, setChangeReasonCustom] = useState('');

  // Approval state
  const [selectedEntries, setSelectedEntries] = useState<Set<number>>(new Set());
  const [approvalStatusFilter, setApprovalStatusFilter] = useState<string>('all');
  const [approvingEntries, setApprovingEntries] = useState(false);

  // History dialog state
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyEntry, setHistoryEntry] = useState<TimeEntry | null>(null);

  // Notes editing state
  const [savingNotes, setSavingNotes] = useState(false);

  // AI enhance dialog state
  const [enhanceDialogOpen, setEnhanceDialogOpen] = useState(false);
  const [enhancingEntry, setEnhancingEntry] = useState<TimeEntry | null>(null);

  // Clarification dialog state
  const [clarifyDialogOpen, setClarifyDialogOpen] = useState(false);
  const [clarifyEntries, setClarifyEntries] = useState<TimeEntry[]>([]);

  // Inline editing state for service item and billable status
  const [editingServiceItemId, setEditingServiceItemId] = useState<number | null>(null);
  const [editingBillableId, setEditingBillableId] = useState<number | null>(null);

  // Post-approval send dialog
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendDialogEntryIds, setSendDialogEntryIds] = useState<number[]>([]);
  const [sendingFromDialog, setSendingFromDialog] = useState(false);

  // Collapsed customer cards (cards with all entries sent auto-collapse)
  const [collapsedCards, setCollapsedCards] = useState<Set<string>>(new Set());

  // Service items list and descriptions keyed by cost code
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [serviceItemDescriptions, setServiceItemDescriptions] = useState<Record<string, string>>({});

  // Report period status (customer-week level)
  const [reportPeriods, setReportPeriods] = useState<ReportPeriod[]>([]);

  // Load customers
  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('qb_customer_id, display_name, email')
        .eq('is_active', true)
        .order('display_name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (err) {
      console.error('Error loading customers:', err);
    }
  };

  // Load service items (for cost code descriptions and inline editing dropdown)
  const loadServiceItems = async () => {
    try {
      const { data, error } = await supabase
        .from('service_items')
        .select('qb_item_id, code, name, description')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      const items = data || [];
      setServiceItems(items.map((item: any) => ({ qb_item_id: item.qb_item_id, name: item.name, code: item.code })));
      const descMap: Record<string, string> = {};
      items.forEach((item: any) => {
        if (item.code) {
          descMap[item.code] = item.description || item.name || '';
        }
        if (item.name) {
          descMap[item.name] = item.description || item.name || '';
        }
      });
      setServiceItemDescriptions(descMap);
    } catch (err) {
      console.error('Error loading service items:', err);
    }
  };

  // Load time entries
  const loadTimeEntries = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('time_entries')
        .select('*')
        .gte('txn_date', startDate)
        .lte('txn_date', endDate);

      if (selectedCustomer !== 'all') {
        query = query.eq('qb_customer_id', selectedCustomer);
      }

      if (selectedEmployee !== 'all') {
        query = query.eq('employee_name', selectedEmployee);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEntries(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load time entries');
    } finally {
      setLoading(false);
    }
  };

  // Load report periods for status badges
  const loadReportPeriods = async () => {
    const { data } = await supabase
      .from('report_periods')
      .select('*')
      .gte('week_end', startDate)
      .lte('week_start', endDate);
    setReportPeriods(data || []);
  };

  // Match a time entry to its report period status
  const getReportStatus = (entry: TimeEntry): ReportPeriod['status'] | null => {
    const match = reportPeriods.find(rp =>
      rp.qb_customer_id === entry.qb_customer_id &&
      entry.txn_date >= rp.week_start &&
      entry.txn_date <= rp.week_end
    );
    return match?.status ?? null;
  };

  // Generate CSV Report
  const generateReport = () => {
    try {
      // Prepare CSV data
      const headers = [
        'Date',
        'Employee',
        'Customer',
        'Cost Code',
        'Start Time',
        'End Time',
        'Hours',
        'Billable',
        'Status',
        'Notes'
      ];

      const rows = sortedEntries.map(entry => {
        const date = format(parseLocalDate(entry.txn_date), 'MM/dd/yyyy');
        const startTime = entry.start_time ? format(new Date(entry.start_time), 'h:mm a') : 'N/A';
        const endTime = entry.end_time ? format(new Date(entry.end_time), 'h:mm a') : 'N/A';
        const hours = `${entry.hours}.${entry.minutes.toString().padStart(2, '0')}`;

        return [
          date,
          entry.employee_name,
          entry.qb_customer_id,
          entry.cost_code,
          startTime,
          endTime,
          hours,
          entry.billable_status,
          entry.approval_status,
          (entry.notes || '').replace(/"/g, '""') // Escape quotes for CSV
        ];
      });

      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `time_entries_${startDate}_to_${endDate}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (err) {
      console.error('❌ Report generation failed:', err);
      setError('Failed to generate report: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  // Email Report - Generic function
  const sendEmailReport = async (recipient: string, recipientType: string, cc?: string[]) => {
    try {
      setError(null);

      // Prepare report data
      const reportData = {
        startDate,
        endDate,
        entries: sortedEntries.map(entry => ({
          date: entry.txn_date,
          employee: entry.employee_name,
          customer: entry.qb_customer_id,
          costCode: entry.cost_code,
          hours: `${entry.hours}.${entry.minutes.toString().padStart(2, '0')}`,
          billable: entry.billable_status,
          description: entry.description
        })),
        summary: {
          totalEntries: entries.length,
          totalHours: calculateTotalHours(entries)
        }
      };

      // Call email edge function
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/email_time_report`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            report: reportData,
            recipient,
            cc: cc || [],
            customerId: selectedCustomer !== 'all' ? selectedCustomer : undefined,
            entryIds: sortedEntries.map(e => e.id),
            sentBy: user?.username || 'system',
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Email failed: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        const ccNote = cc?.length ? ` (CC: ${cc.join(', ')})` : '';
        setError(`✅ Report emailed successfully to ${recipientType}${ccNote}!`);
      } else {
        throw new Error(result.error || 'Email sending failed');
      }

    } catch (err) {
      console.error('❌ Email report failed:', err);
      setError('Failed to email report: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  // Send from post-approval dialog
  const sendFromDialog = async (mode: 'test' | 'customer' | 'skip') => {
    if (mode === 'skip') {
      setSendDialogOpen(false);
      setSendDialogEntryIds([]);
      return;
    }

    setSendingFromDialog(true);
    try {
      if (mode === 'test') {
        // Send to David, CC Sharon for review
        await sendApprovedEntriesToCustomerWithOverride(sendDialogEntryIds, 'david@mitigationconsulting.com', ['skisner@mitigationconsulting.com']);
        setError('✅ Test report sent to David & Sharon!');
      } else {
        // Send to actual customer with CC
        await sendApprovedEntriesToCustomer(sendDialogEntryIds);
        setError('✅ Report sent to customer (CC: Sharon & David)!');
      }
    } catch (err) {
      setError(`⚠️ Send failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setSendingFromDialog(false);
      setSendDialogOpen(false);
      setSendDialogEntryIds([]);
    }
  };

  // Send with explicit recipient override (for test mode from dialog)
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
          billable: entry.billable_status, description: entry.description
        })),
        summary: { totalEntries: customerEntries.length, totalHours: calculateTotalHours(customerEntries) }
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/email_time_report`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: reportData, recipient: toEmail, cc: ccEmails, entryIds: customerEntries.map(e => e.id), customerId, sentBy: user?.username || 'system' })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Edge function error:', errText);
        throw new Error(`Email failed (${response.status}): ${errText}`);
      }

      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Email sending failed');

      // Update entries to 'sent' in DB
      await supabase
        .from('time_entries')
        .update({ approval_status: 'sent', sent_at: new Date().toISOString(), sent_to: toEmail })
        .in('id', customerEntries.map(e => e.id));
    }

    // Update local state
    setEntries(prev => prev.map(e =>
      entryIds.includes(e.id)
        ? { ...e, approval_status: 'sent', sent_at: new Date().toISOString(), sent_to: toEmail } as any
        : e
    ));
  };

  // Toggle card collapse
  const toggleCardCollapse = (customerId: string) => {
    setCollapsedCards(prev => {
      const next = new Set(prev);
      if (next.has(customerId)) next.delete(customerId);
      else next.add(customerId);
      return next;
    });
  };

  // Send report respecting test mode toggle
  const sendReportToCustomer = () => {
    if (testMode) {
      // Test mode: send to David only
      sendEmailReport('david@mitigationconsulting.com', 'David (test mode)');
    } else {
      // Production: send to customer with CC to Sharon + David
      if (selectedCustomer === 'all') {
        setError('⚠️ Please select a specific customer to email the report to them.');
        return;
      }
      const customer = customers.find(c => c.qb_customer_id === selectedCustomer);
      if (!customer) { setError('❌ Customer not found'); return; }
      if (!customer.email) { setError('❌ Customer email not found. Please add customer email in QuickBooks.'); return; }
      sendEmailReport(
        customer.email,
        `Customer (${customer.display_name})`,
        ['skisner@mitigationconsulting.com', 'david@mitigationconsulting.com']
      );
    }
  };

  // Approval Functions
  const toggleEntrySelection = (entryId: number) => {
    const newSelection = new Set(selectedEntries);
    if (newSelection.has(entryId)) {
      newSelection.delete(entryId);
    } else {
      newSelection.add(entryId);
    }
    setSelectedEntries(newSelection);
  };

  const selectAllEntries = () => {
    const filteredEntries = getFilteredAndSortedEntries();
    const allIds = new Set(filteredEntries.map(e => e.id));
    setSelectedEntries(allIds);
  };

  const deselectAllEntries = () => {
    setSelectedEntries(new Set());
  };

  const approveSelectedEntries = async () => {
    if (selectedEntries.size === 0) {
      setError('⚠️ No entries selected');
      return;
    }

    try {
      setApprovingEntries(true);
      setError(null);

      const entryIds = Array.from(selectedEntries);
      const userEmail = user?.username || 'unknown';

      // Update entries to approved status
      const { data: updateData, error: updateError } = await supabase
        .from('time_entries')
        .update({
          approval_status: 'approved',
          approved_by: userEmail,
          approved_at: new Date().toISOString()
        })
        .in('id', entryIds)
        .select();

      if (updateError) throw updateError;

      // Log approval action (non-blocking)
      supabase.from('approval_audit_log').insert(
        entryIds.map(id => ({
          time_entry_id: id,
          action: 'approved',
          performed_by: userEmail,
          performed_at: new Date().toISOString(),
          details: { method: 'bulk_approve' }
        }))
      );

      // Update local state immediately so UI reflects the change
      setEntries(prev => prev.map(e =>
        entryIds.includes(e.id)
          ? { ...e, approval_status: 'approved', approved_by: userEmail, approved_at: new Date().toISOString() }
          : e
      ));
      setSelectedEntries(new Set());
      setError(`✅ Approved ${entryIds.length} entries!`);

      // Show send dialog so user can choose how to send
      setSendDialogEntryIds(entryIds);
      setSendDialogOpen(true);

    } catch (err) {
      console.error('Approval failed:', err);
      setError(`❌ Failed to approve entries: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setApprovingEntries(false);
    }
  };

  const approveAllEntries = async () => {
    const filteredEntries = getFilteredAndSortedEntries();
    const pendingEntries = filteredEntries.filter(e => e.approval_status === 'pending');

    if (pendingEntries.length === 0) {
      setError('⚠️ No pending entries to approve');
      return;
    }

    const allIds = new Set(pendingEntries.map(e => e.id));
    setSelectedEntries(allIds);
    await approveSelectedEntries();
  };

  const sendApprovedEntriesToCustomer = async (entryIds: number[]) => {
    try {
      // Get the entries
      const { data: entriesToSend, error: fetchError } = await supabase
        .from('time_entries')
        .select('*')
        .in('id', entryIds);

      if (fetchError) throw fetchError;
      if (!entriesToSend || entriesToSend.length === 0) return;

      // Group by customer
      const byCustomer = new Map<string, typeof entriesToSend>();
      entriesToSend.forEach(entry => {
        const custId = entry.qb_customer_id;
        if (!byCustomer.has(custId)) {
          byCustomer.set(custId, []);
        }
        byCustomer.get(custId)!.push(entry);
      });

      // Send one email per customer
      for (const [customerId, customerEntries] of byCustomer) {
        const customer = customers.find(c => c.qb_customer_id === customerId);
        if (!testMode && !customer?.email) {
          console.warn(`No email for customer ${customerId}, skipping`);
          continue;
        }

        // Determine recipient based on test mode
        const recipient = testMode
          ? 'david@mitigationconsulting.com'
          : customer!.email!;
        const cc = testMode
          ? []
          : ['skisner@mitigationconsulting.com', 'david@mitigationconsulting.com'];

        // Prepare report data
        const reportData = {
          startDate,
          endDate,
          entries: customerEntries.map(entry => ({
            date: entry.txn_date,
            employee: entry.employee_name,
            customer: entry.qb_customer_id,
            costCode: entry.cost_code,
            hours: `${entry.hours}.${entry.minutes.toString().padStart(2, '0')}`,
            billable: entry.billable_status,
            description: entry.description
          })),
          summary: {
            totalEntries: customerEntries.length,
            totalHours: calculateTotalHours(customerEntries)
          }
        };

        // Send email
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/email_time_report`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              report: reportData,
              recipient,
              cc,
              entryIds: customerEntries.map(e => e.id),
              customerId: customerId,
              sentBy: user?.username || 'system'
            })
          }
        );

        if (response.ok) {
          // Update entries as sent
          await supabase
            .from('time_entries')
            .update({
              approval_status: 'sent',
              sent_at: new Date().toISOString(),
              sent_to: recipient
            })
            .in('id', customerEntries.map(e => e.id));

          // Log send action
          await supabase.from('approval_audit_log').insert(
            customerEntries.map(e => ({
              time_entry_id: e.id,
              action: 'sent',
              performed_by: user?.username || 'system',
              performed_at: new Date().toISOString(),
              details: { recipient }
            }))
          );
        }
      }
    } catch (err) {
      console.error('Failed to send emails:', err);
      throw err;
    }
  };

  // Save edited notes
  const saveNotes = async (entryId: number, newNotes: string) => {
    const userEmail = user?.username || 'unknown';
    const entry = entries.find(e => e.id === entryId);
    const currentEditCount = entry?.edit_count || 0;

    setSavingNotes(true);
    try {
      const { error: updateError } = await supabase
        .from('time_entries')
        .update({
          notes: newNotes,
          updated_at: new Date().toISOString(),
          updated_by: userEmail,
          manually_edited: true,
          edit_count: currentEditCount + 1,
        })
        .eq('id', entryId);

      if (updateError) throw updateError;

      // Update local state
      setEntries(entries.map(e =>
        e.id === entryId
          ? {
              ...e,
              notes: newNotes,
              manually_edited: true,
              edit_count: currentEditCount + 1,
              updated_at: new Date().toISOString(),
              updated_by: userEmail,
            }
          : e
      ));

      // Write back to QuickBooks Time (async, non-blocking)
      try {
        const qbResult = await callEdgeFunction('update_qb_time_entry', {
          entry_id: entryId,
          notes: newNotes,
          user_email: userEmail,
        });
        if (!qbResult.success) {
          console.warn('⚠️ QB Time sync-back failed:', qbResult.error);
        }
      } catch (qbErr) {
        // Non-blocking — local save succeeded, QB sync is best-effort
        console.warn('⚠️ Could not sync notes back to QB Time:', qbErr);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save notes';
      setError(msg);
      throw err;
    } finally {
      setSavingNotes(false);
    }
  };

  // Save service item change
  const saveServiceItem = async (entryId: number, newQbItemId: string) => {
    const userEmail = user?.username || 'unknown';
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;
    const currentEditCount = entry.edit_count || 0;
    const selectedItem = serviceItems.find(si => si.qb_item_id === newQbItemId);
    if (!selectedItem) return;

    try {
      const { error: updateError } = await supabase
        .from('time_entries')
        .update({
          qb_item_id: newQbItemId,
          service_item_name: selectedItem.name,
          cost_code: selectedItem.code || selectedItem.name,
          updated_at: new Date().toISOString(),
          updated_by: userEmail,
          manually_edited: true,
          edit_count: currentEditCount + 1,
        })
        .eq('id', entryId);

      if (updateError) throw updateError;

      // Update local state
      setEntries(prev => prev.map(e =>
        e.id === entryId
          ? {
              ...e,
              qb_item_id: newQbItemId,
              service_item_name: selectedItem.name,
              cost_code: selectedItem.code || selectedItem.name,
              manually_edited: true,
              edit_count: currentEditCount + 1,
              updated_at: new Date().toISOString(),
              updated_by: userEmail,
            }
          : e
      ));

      // Write back to QB Online (async, non-blocking)
      try {
        const qbResult = await callEdgeFunction('update_qb_time_entry', {
          entry_id: entryId,
          qb_item_id: newQbItemId,
          user_email: userEmail,
        });
        if (!qbResult.success) {
          console.warn('⚠️ QB Online sync-back failed:', qbResult.error);
        }
      } catch (qbErr) {
        console.warn('⚠️ Could not sync service item back to QB:', qbErr);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save service item';
      setError(msg);
    }
  };

  // Save billable status change (local-only, no QB write-back)
  const saveBillableStatus = async (entryId: number, newStatus: string) => {
    const userEmail = user?.username || 'unknown';
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;
    const currentEditCount = entry.edit_count || 0;

    try {
      const { error: updateError } = await supabase
        .from('time_entries')
        .update({
          billable_status: newStatus,
          updated_at: new Date().toISOString(),
          updated_by: userEmail,
          manually_edited: true,
          edit_count: currentEditCount + 1,
        })
        .eq('id', entryId);

      if (updateError) throw updateError;

      // Update local state
      setEntries(prev => prev.map(e =>
        e.id === entryId
          ? {
              ...e,
              billable_status: newStatus,
              manually_edited: true,
              edit_count: currentEditCount + 1,
              updated_at: new Date().toISOString(),
              updated_by: userEmail,
            }
          : e
      ));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save billable status';
      setError(msg);
    }
  };

  // Sync from QuickBooks
  const syncFromQuickBooks = async () => {
    try {
      setSyncing(true);
      setError(null);

      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/qb-time-sync`;
      const requestBody = { startDate, endDate, billableOnly: false };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const responseData = await response.json();

      if (!response.ok) {
        const errorMessage = responseData.error || 'Sync failed';
        console.error('❌ QB Sync: Error:', errorMessage);

        // Show detailed error in UI
        if (responseData.error && responseData.error.includes('invalid_client')) {
          setError('QuickBooks authentication failed. Client credentials may be incorrect. Check Edge Function logs in Supabase.');
        } else if (responseData.error && responseData.error.includes('Token refresh failed')) {
          setError(`Token refresh failed: ${responseData.error}`);
        } else {
          setError(`Sync failed: ${errorMessage}`);
        }
        return;
      }

      // Show success message
      setError(`✅ Success! Synced ${responseData.synced} time entries from ${responseData.customers} customers.`);

      await loadTimeEntries();
    } catch (err) {
      console.error('❌ QB Sync: Fatal error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync with QuickBooks';
      setError(`Fatal error: ${errorMessage}`);
    } finally {
      setSyncing(false);
    }
  };

  // Handle date preset change
  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();

    switch (preset) {
      case 'this_week':
        setStartDate(format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
        setEndDate(format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
        break;
      case 'last_week':
        const lastWeek = subMonths(now, 0);
        const lastWeekStart = startOfWeek(new Date(lastWeek.getTime() - 7 * 24 * 60 * 60 * 1000), { weekStartsOn: 1 });
        setStartDate(format(lastWeekStart, 'yyyy-MM-dd'));
        setEndDate(format(endOfWeek(lastWeekStart, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
        break;
      case 'this_month':
        setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'));
        setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'));
        break;
      case 'last_month':
        const lastMonth = subMonths(now, 1);
        setStartDate(format(startOfMonth(lastMonth), 'yyyy-MM-dd'));
        setEndDate(format(endOfMonth(lastMonth), 'yyyy-MM-dd'));
        break;
      case 'all_time':
        // Show all data - set a very wide date range
        setStartDate('2020-01-01');
        setEndDate(format(new Date(), 'yyyy-MM-dd'));
        break;
    }
  };

  // Handle lock/unlock toggle
  const handleLockToggle = async (entry: TimeEntry) => {
    if (!user) return;

    const locking = !entry.is_locked;

    // If unlocking a sent or accepted entry, require a change reason
    if (!locking && (entry.approval_status === 'sent' || entry.approval_status === 'accepted')) {
      setChangeReasonEntry(entry);
      setChangeReason('');
      setChangeReasonCustom('');
      setChangeReasonDialogOpen(true);
      return;
    }

    await performUnlock(entry);
  };

  // Perform the actual unlock (called directly or after change reason dialog)
  const performUnlock = async (entry: TimeEntry, reason?: string) => {
    if (!user) return;

    try {
      const locking = !entry.is_locked;
      const functionName = locking ? 'lock_time_entry' : 'unlock_time_entry';

      const data = await callEdgeFunction(functionName, {
        entry_id: entry.id,
        user_email: user.username
      });

      if (!data.success) throw new Error(data.error || data.message);

      // If this was a post-send unlock with a reason, update the entry
      if (reason && (entry.approval_status === 'sent' || entry.approval_status === 'accepted')) {
        await supabase
          .from('time_entries')
          .update({
            change_reason: reason,
            post_send_edit: true,
            amended_at: new Date().toISOString(),
            approval_status: 'amended',
          })
          .eq('id', entry.id);
      }

      // Update local state
      const updatedFields: Partial<TimeEntry> = {
        is_locked: locking,
        unlocked_by: locking ? null : user.username,
        unlocked_at: locking ? null : new Date().toISOString(),
      };

      // If post-send edit, also update local status to amended
      if (reason && (entry.approval_status === 'sent' || entry.approval_status === 'accepted')) {
        (updatedFields as any).approval_status = 'amended';
        (updatedFields as any).change_reason = reason;
        (updatedFields as any).post_send_edit = true;
      }

      setEntries(entries.map(e =>
        e.id === entry.id ? { ...e, ...updatedFields } : e
      ));
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  // Handle change reason dialog submit
  const handleChangeReasonSubmit = () => {
    if (!changeReasonEntry) return;
    const reason = changeReason === 'custom' ? changeReasonCustom : changeReason;
    if (!reason.trim()) {
      alert('Please select or enter a reason for the change.');
      return;
    }
    setChangeReasonDialogOpen(false);
    performUnlock(changeReasonEntry, reason);
  };

  // Get unique employees from entries
  const uniqueEmployees = useMemo(() => {
    const employees = new Set(entries.map(e => e.employee_name));
    return Array.from(employees).sort();
  }, [entries]);

  // Helper function to get filtered and sorted entries
  const getFilteredAndSortedEntries = () => {
    let filtered = sortedEntries;

    // Apply approval status filter
    if (approvalStatusFilter === 'not_sent') {
      filtered = filtered.filter(e => !e.approval_status || e.approval_status === 'pending' || e.approval_status === 'approved');
    } else if (approvalStatusFilter === 'edited') {
      filtered = filtered.filter(e => e.manually_edited || e.edit_count > 0);
    } else if (approvalStatusFilter !== 'all') {
      filtered = filtered.filter(e => e.approval_status === approvalStatusFilter);
    }

    return filtered;
  };

  // Sort and group entries
  const sortedEntries = useMemo(() => {
    const sorted = [...entries].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'datetime':
          const dateCompare = a.txn_date.localeCompare(b.txn_date);
          if (dateCompare !== 0) {
            comparison = dateCompare;
          } else if (a.start_time && b.start_time) {
            comparison = a.start_time.localeCompare(b.start_time);
          }
          break;
        case 'employee':
          comparison = a.employee_name.localeCompare(b.employee_name);
          break;
        case 'costcode':
          comparison = (a.cost_code || '').localeCompare(b.cost_code || '');
          break;
      }

      // Apply sort direction
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [entries, sortBy, sortDirection]);

  // Group by customer
  const groupedByCustomer = useMemo(() => {
    const groups = new Map<string, TimeEntry[]>();
    sortedEntries.forEach(entry => {
      const customerId = entry.qb_customer_id;
      if (!groups.has(customerId)) {
        groups.set(customerId, []);
      }
      groups.get(customerId)!.push(entry);
    });
    return groups;
  }, [sortedEntries]);

  // Calculate total hours for a group
  const calculateTotalHours = (entries: TimeEntry[]) => {
    const totalMinutes = entries.reduce((sum, entry) => {
      return sum + (entry.hours * 60) + entry.minutes;
    }, 0);
    return (totalMinutes / 60).toFixed(1);
  };

  // Parse date string in local timezone (avoids UTC conversion issues)
  const parseLocalDate = (dateString: string) => {
    // Parse YYYY-MM-DD as local date, not UTC
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // Format time range
  const formatTimeRange = (entry: TimeEntry) => {
    if (entry.start_time && entry.end_time) {
      // Handle both full timestamps and time-only strings
      const startDate = entry.start_time?.includes('T')
        ? new Date(entry.start_time)
        : new Date(`2000-01-01T${entry.start_time}`);
      const endDate = entry.end_time?.includes('T')
        ? new Date(entry.end_time)
        : new Date(`2000-01-01T${entry.end_time}`);

      const start = format(startDate, 'h:mm a');
      const end = format(endDate, 'h:mm a');
      return `${start} - ${end}`;
    }
    return 'Lump sum entry';
  };

  // Format duration
  const formatDuration = (hours: number, minutes: number) => {
    return `${hours}.${minutes.toString().padStart(2, '0')} hrs`;
  };

  // Initialize
  useEffect(() => {
    loadCustomers();
    loadServiceItems();
  }, []);

  useEffect(() => {
    loadTimeEntries();
    loadReportPeriods();
  }, [startDate, endDate, selectedCustomer, selectedEmployee]);

  return (
    <AppShell>
      <PageHeader
        title="Time Entries"
        subtitle="Production QuickBooks Data"
        icon={<Clock className="w-6 h-6 text-blue-600" />}
        actions={
          <button
            onClick={syncFromQuickBooks}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync from QB'}
          </button>
        }
      />

      {/* Filters */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Date Range Picker */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Range
            </label>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-wrap gap-2">
                {(['this_week', 'last_week', 'this_month', 'last_month'] as DatePreset[]).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handleDatePresetChange(preset)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      datePreset === preset
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {preset.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </button>
                ))}
                <button
                  onClick={() => handleDatePresetChange('all_time')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    datePreset === 'all_time'
                      ? 'bg-green-600 text-white'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  📊 Show All Data
                </button>
              </div>
              <div className="flex items-end gap-3 ml-auto">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">From</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setDatePreset('custom');
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">To</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setDatePreset('custom');
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Filters Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            {/* Customer Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer
              </label>
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Customers</option>
                {customers.map(customer => (
                  <option key={customer.qb_customer_id} value={customer.qb_customer_id}>
                    {customer.display_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Employee Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Employee
              </label>
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Employees</option>
                {uniqueEmployees.map(employee => (
                  <option key={employee} value={employee}>
                    {employee}
                  </option>
                ))}
              </select>
            </div>

            {/* Approval Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Approval Status
              </label>
              <select
                value={approvalStatusFilter}
                onChange={(e) => setApprovalStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="not_sent">🔴 Not Sent (Pending + Approved)</option>
                <option value="edited">✏️ Edited / Changed</option>
                <option value="pending">⏳ Pending</option>
                <option value="approved">✅ Approved</option>
                <option value="sent">📧 Sent</option>
                <option value="delivered">📬 Delivered</option>
                <option value="read">📖 Read</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sort By
              </label>
              <div className="flex gap-2">
                {[
                  { value: 'datetime', label: 'Date/Time' },
                  { value: 'employee', label: 'Employee' },
                  { value: 'costcode', label: 'Cost Code' }
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => setSortBy(option.value as typeof sortBy)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      sortBy === option.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
                {/* Sort Direction Toggle */}
                <button
                  onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors flex items-center gap-1"
                  title={sortDirection === 'asc' ? 'Oldest to Newest' : 'Newest to Oldest'}
                >
                  {sortDirection === 'asc' ? (
                    <>
                      <ArrowUp className="w-4 h-4" />
                      <span className="hidden sm:inline">Old→New</span>
                    </>
                  ) : (
                    <>
                      <ArrowDown className="w-4 h-4" />
                      <span className="hidden sm:inline">New→Old</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
        {error && (
          <div className={`mb-6 border-2 rounded-lg p-6 shadow-lg ${
            error.startsWith('✅')
              ? 'bg-green-50 border-green-300'
              : 'bg-red-50 border-red-300'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`mt-1 ${error.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
                {error.startsWith('✅') ? '✅' : '⚠️'}
              </div>
              <div className="flex-1">
                <h3 className={`text-lg font-bold mb-2 ${
                  error.startsWith('✅') ? 'text-green-900' : 'text-red-900'
                }`}>
                  {error.startsWith('✅') ? 'Success' : 'Sync Error'}
                </h3>
                <p className={`whitespace-pre-wrap font-mono text-sm ${
                  error.startsWith('✅') ? 'text-green-800' : 'text-red-800'
                }`}>{error}</p>
                {!error.startsWith('✅') && (
                  <p className="text-red-600 text-xs mt-3">
                    Check browser console (F12) for detailed debug logs.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Time Entries Found</h3>
            <p className="text-gray-600 mb-6">
              No time entries found for the selected date range and filters.
            </p>
            <button
              onClick={syncFromQuickBooks}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <RefreshCw className="w-4 h-4" />
              Sync from QuickBooks
            </button>
          </div>
        ) : (
          <>
            {/* Unlocked Entries Warning */}
            {entries.some(e => !e.is_locked) && (
              <div className="mb-4 bg-orange-50 border-l-4 border-orange-500 p-3 rounded-r-md">
                <p className="text-sm text-orange-800">
                  <strong>{entries.filter(e => !e.is_locked).length} entries</strong> are unlocked and editable.
                  Edits will sync back to QuickBooks Time when saved.
                </p>
              </div>
            )}

            {/* Summary Bar */}
            <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Entries: <span className="font-semibold text-gray-900">{entries.length}</span></p>
                  <p className="text-sm text-gray-600">Total Hours: <span className="font-semibold text-gray-900">{calculateTotalHours(entries)} hrs</span></p>
                </div>
                <div className="flex flex-col gap-3">
                  {/* Approval Buttons Row */}
                  <div className="flex gap-2">
                    <button
                      onClick={approveSelectedEntries}
                      disabled={selectedEntries.size === 0 || approvingEntries}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={selectedEntries.size === 0 ? 'Select entries to approve' : `Approve ${selectedEntries.size} selected entries`}
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve Selected ({selectedEntries.size})
                    </button>
                    <button
                      onClick={approveAllEntries}
                      disabled={approvingEntries || entries.filter(e => e.approval_status === 'pending').length === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Approve all pending entries for current filter"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve All Pending
                    </button>
                    {selectedEntries.size > 0 && (
                      <>
                        <button
                          onClick={() => {
                            const selected = entries.filter(e => selectedEntries.has(e.id));
                            setClarifyEntries(selected);
                            setClarifyDialogOpen(true);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                          title={`Request clarification for ${selectedEntries.size} selected entries`}
                        >
                          <MessageSquare className="w-4 h-4" />
                          Clarify ({selectedEntries.size})
                        </button>
                        <button
                          onClick={deselectAllEntries}
                          className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                          title="Clear selection"
                        >
                          <X className="w-4 h-4" />
                          Clear
                        </button>
                      </>
                    )}
                  </div>

                  {/* Generate Report Button */}
                  <button
                    onClick={generateReport}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={entries.length === 0}
                    title={entries.length === 0 ? 'No entries to report' : 'Download CSV report'}
                  >
                    <FileText className="w-4 h-4" />
                    Generate Report
                  </button>

                  {/* Test Mode Toggle + Send Report */}
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div
                        onClick={() => setTestMode(!testMode)}
                        className={`relative w-10 h-6 rounded-full transition-colors ${testMode ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${testMode ? 'translate-x-0.5' : 'translate-x-4'}`} />
                      </div>
                      <span className={`text-xs font-semibold ${testMode ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {testMode ? 'TEST MODE — sends to David & Sharon' : 'LIVE — sends to customer + CC Sharon & David'}
                      </span>
                    </label>

                    <button
                      onClick={sendReportToCustomer}
                      disabled={entries.length === 0 || (!testMode && selectedCustomer === 'all')}
                      className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        testMode ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                      }`}
                      title={testMode ? 'Send report to David for testing' : 'Send report to customer with CC'}
                    >
                      <Mail className="w-4 h-4" />
                      {testMode ? 'Send Report (Test)' : 'Send Report to Customer'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Conditional Display: Grouped by Customer or Flat List */}
            {selectedCustomer === 'all' ? (
              /* Grouped View - Show all customers with headers */
              Array.from(groupedByCustomer.entries()).map(([customerId, customerEntries]) => {
                const customerName = customers.find(c => c.qb_customer_id === customerId)?.display_name || customerId;

                // Calculate card status
                const allSent = customerEntries.every(e => e.approval_status === 'sent' || e.approval_status === 'delivered' || e.approval_status === 'read');
                const allApproved = customerEntries.every(e => e.approval_status === 'approved' || e.approval_status === 'sent' || e.approval_status === 'delivered' || e.approval_status === 'read');
                const someApproved = customerEntries.some(e => e.approval_status === 'approved' || e.approval_status === 'sent');
                const isCollapsed = collapsedCards.has(customerId) || allSent;
                const isExpanded = !isCollapsed;
                const allSelectedInCard = customerEntries.every(e => selectedEntries.has(e.id));
                const someSelectedInCard = customerEntries.some(e => selectedEntries.has(e.id));

                // Header gradient based on status
                const headerGradient = allSent
                  ? 'from-emerald-600 to-emerald-700'
                  : allApproved
                  ? 'from-amber-500 to-amber-600'
                  : 'from-blue-600 to-blue-700';

                return (
                  <div key={customerId} className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Customer Header — clickable to collapse/expand */}
                    <div
                      className={`bg-gradient-to-r ${headerGradient} px-6 py-4 cursor-pointer select-none`}
                      onClick={() => toggleCardCollapse(customerId)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isExpanded
                            ? <ChevronDown className="w-5 h-5 text-white/80" />
                            : <ChevronRight className="w-5 h-5 text-white/80" />
                          }
                          <Building2 className="w-6 h-6 text-white" />
                          <div>
                            <h2 className="text-xl font-bold text-white">{customerName}</h2>
                            <p className="text-white/80 text-sm">
                              {customerEntries.length} entries • {calculateTotalHours(customerEntries)} hours
                            </p>
                          </div>
                        </div>
                        {/* Status Badge + Select All */}
                        <div className="flex items-center gap-3">
                          {allSent && (
                            <span className="px-3 py-1 bg-white/20 text-white text-xs font-bold rounded-full">
                              Sent {startDate} – {endDate}
                            </span>
                          )}
                          {!allSent && allApproved && (
                            <span className="px-3 py-1 bg-white/20 text-white text-xs font-bold rounded-full">
                              Approved — Not Sent
                            </span>
                          )}
                          {!allSent && !allApproved && someApproved && (
                            <span className="px-3 py-1 bg-white/20 text-white text-xs font-bold rounded-full">
                              Partially Approved
                            </span>
                          )}
                          {!allSent && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const ids = customerEntries.map(en => en.id);
                                setSelectedEntries(prev => {
                                  const next = new Set(prev);
                                  if (allSelectedInCard) {
                                    ids.forEach(id => next.delete(id));
                                  } else {
                                    ids.forEach(id => next.add(id));
                                  }
                                  return next;
                                });
                              }}
                              className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${
                                allSelectedInCard
                                  ? 'bg-white text-blue-700 hover:bg-blue-50'
                                  : 'bg-white/20 text-white hover:bg-white/30'
                              }`}
                            >
                              {allSelectedInCard ? '✓ All Selected' : someSelectedInCard ? `Select All (${customerEntries.filter(e => selectedEntries.has(e.id)).length}/${customerEntries.length})` : 'Select All'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Time Entries — hidden when collapsed */}
                    {isExpanded && (<>
                    <div className="divide-y divide-gray-200">
                      {customerEntries.map((entry, idx) => (
                        <div key={entry.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start gap-4">
                          {/* Checkbox */}
                          <div className="flex-shrink-0 pt-1">
                            <input
                              type="checkbox"
                              checked={selectedEntries.has(entry.id)}
                              onChange={() => toggleEntrySelection(entry.id)}
                              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                              title="Select for approval"
                            />
                          </div>

                          {/* Date & Time */}
                          <div className="flex-shrink-0 w-48">
                            <div className="flex items-center gap-2 text-gray-900 font-medium">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              {format(parseLocalDate(entry.txn_date), 'EEE MMM dd, yyyy')}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                              <Clock className="w-4 h-4 text-gray-400" />
                              {formatTimeRange(entry)}
                            </div>
                            <div className="text-sm font-semibold text-blue-600 mt-1">
                              {formatDuration(entry.hours, entry.minutes)}
                            </div>
                          </div>

                          {/* Details */}
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-gray-400" />
                                <span className="font-medium text-gray-900">{entry.employee_name}</span>
                              </div>
                              {/* Service Item Badge (click-to-edit) */}
                              {editingServiceItemId === entry.id ? (
                                <select
                                  autoFocus
                                  className="px-2 py-1 text-xs font-semibold rounded border border-purple-300 bg-white text-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-400"
                                  value={entry.qb_item_id || ''}
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      saveServiceItem(entry.id, e.target.value);
                                    }
                                    setEditingServiceItemId(null);
                                  }}
                                  onBlur={() => setEditingServiceItemId(null)}
                                >
                                  <option value="" disabled>Select item...</option>
                                  {serviceItems.map(si => (
                                    <option key={si.qb_item_id} value={si.qb_item_id}>
                                      {si.name}{si.code ? ` (${si.code})` : ''}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span
                                  className={`px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded ${!entry.is_locked ? 'cursor-pointer hover:bg-purple-200' : ''}`}
                                  onClick={() => { if (!entry.is_locked) setEditingServiceItemId(entry.id); }}
                                  title={entry.is_locked ? 'Locked' : 'Click to change service item'}
                                >
                                  {entry.service_item_name || entry.cost_code}
                                </span>
                              )}
                              {/* Billable Status Badge (click-to-edit) */}
                              {editingBillableId === entry.id ? (
                                <select
                                  autoFocus
                                  className="px-2 py-1 text-xs font-semibold rounded border border-green-300 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400"
                                  value={entry.billable_status}
                                  onChange={(e) => {
                                    saveBillableStatus(entry.id, e.target.value);
                                    setEditingBillableId(null);
                                  }}
                                  onBlur={() => setEditingBillableId(null)}
                                >
                                  <option value="Billable">Billable</option>
                                  <option value="NotBillable">Not Billable</option>
                                </select>
                              ) : (
                                <span
                                  className={`px-2 py-1 text-xs font-semibold rounded ${
                                    entry.billable_status === 'Billable'
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-gray-100 text-gray-700'
                                  } ${!entry.is_locked ? 'cursor-pointer hover:opacity-80' : ''}`}
                                  onClick={() => { if (!entry.is_locked) setEditingBillableId(entry.id); }}
                                  title={entry.is_locked ? 'Locked' : 'Click to change billable status'}
                                >
                                  {entry.billable_status}
                                </span>
                              )}
                              {/* Approval Status Badge */}
                              <span className={`px-2 py-1 text-xs font-semibold rounded ${
                                entry.approval_status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                entry.approval_status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                entry.approval_status === 'sent' ? 'bg-blue-100 text-blue-700' :
                                entry.approval_status === 'delivered' ? 'bg-indigo-100 text-indigo-700' :
                                entry.approval_status === 'read' ? 'bg-purple-100 text-purple-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {entry.approval_status === 'pending' && '⏳ Pending'}
                                {entry.approval_status === 'approved' && '✅ Approved'}
                                {entry.approval_status === 'sent' && '📧 Sent'}
                                {entry.approval_status === 'delivered' && '📬 Delivered'}
                                {entry.approval_status === 'read' && '📖 Read'}
                                {!entry.approval_status && 'No Status'}
                              </span>
                              {/* Report Status Badge */}
                              {(() => {
                                const rs = getReportStatus(entry);
                                const effectiveStatus = rs || 'unbilled';
                                const styles: Record<string, string> = {
                                  unbilled: 'bg-gray-50 text-gray-500 border-gray-200',
                                  pending: 'bg-gray-50 text-gray-500 border-gray-200',
                                  sent: 'bg-blue-50 text-blue-600 border-blue-200',
                                  supplemental_sent: 'bg-blue-50 text-blue-600 border-blue-200',
                                  accepted: 'bg-green-50 text-green-600 border-green-200',
                                  disputed: 'bg-red-50 text-red-600 border-red-200',
                                  no_time: 'bg-gray-50 text-gray-500 border-gray-200',
                                };
                                const labels: Record<string, string> = {
                                  unbilled: 'Unbilled',
                                  pending: 'Unbilled',
                                  sent: 'Report Sent',
                                  supplemental_sent: 'Supplemental',
                                  accepted: 'Accepted',
                                  disputed: 'Disputed',
                                  no_time: 'No Time',
                                };
                                return (
                                  <span data-testid="entry-status-badge" className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${styles[effectiveStatus] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                    {labels[effectiveStatus] || effectiveStatus}
                                  </span>
                                );
                              })()}
                              <LockIcon
                                isLocked={entry.is_locked}
                                unlockedBy={entry.unlocked_by}
                                unlockedAt={entry.unlocked_at}
                                onToggle={() => handleLockToggle(entry)}
                              />
                              {/* Edited Badge */}
                              {entry.manually_edited && (
                                <span className="px-2 py-1 text-xs font-semibold rounded bg-amber-100 text-amber-700">
                                  Edited
                                </span>
                              )}
                              {/* History Button */}
                              <button
                                onClick={() => {
                                  setHistoryEntry(entry);
                                  setHistoryDialogOpen(true);
                                }}
                                className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                                title="View tracking history"
                              >
                                <History className="w-3 h-3" />
                                History
                              </button>
                              {/* Enhance Button */}
                              {!entry.is_locked && (
                                <button
                                  onClick={() => {
                                    setEnhancingEntry(entry);
                                    setEnhanceDialogOpen(true);
                                  }}
                                  className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
                                  title="Enhance notes with AI"
                                >
                                  <Sparkles className="w-3 h-3" />
                                  Enhance
                                </button>
                              )}
                              {/* Clarify Button */}
                              <button
                                onClick={() => {
                                  setClarifyEntries([entry]);
                                  setClarifyDialogOpen(true);
                                }}
                                className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                                title="Request clarification"
                              >
                                <MessageSquare className="w-3 h-3" />
                                Clarify
                              </button>
                              {/* Active clarification badge */}
                              {entry.has_active_clarification && (
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" title="Clarification pending" />
                              )}
                            </div>

                            {/* Cost Code Description (read-only, from service_items) */}
                            {(serviceItemDescriptions[entry.cost_code] || serviceItemDescriptions[entry.service_item_name]) && (
                              <div className="text-sm text-gray-700 mb-1">
                                <span className="font-medium">Cost Code Description:</span> {serviceItemDescriptions[entry.cost_code] || serviceItemDescriptions[entry.service_item_name]}
                              </div>
                            )}

                            {/* Technician Notes (editable when unlocked) */}
                            <InlineNotesEditor
                              entryId={entry.id}
                              currentNotes={entry.notes}
                              isLocked={entry.is_locked}
                              isSaving={savingNotes}
                              onSave={saveNotes}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                    {/* Customer Total */}
                    <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Total for {customerName}</span>
                        <span className="text-lg font-bold text-gray-900">{calculateTotalHours(customerEntries)} hours</span>
                      </div>
                    </div>
                    </>)}
                  </div>
                );
              })
            ) : (
              /* Flat List View - Single customer selected, show entries by date */
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="divide-y divide-gray-200">
                  {sortedEntries.map((entry) => (
                    <div key={entry.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start gap-4">
                        {/* Checkbox */}
                        <div className="flex-shrink-0 pt-1">
                          <input
                            type="checkbox"
                            checked={selectedEntries.has(entry.id)}
                            onChange={() => toggleEntrySelection(entry.id)}
                            className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            title="Select for approval"
                          />
                        </div>

                        {/* Date & Time */}
                        <div className="flex-shrink-0 w-48">
                          <div className="flex items-center gap-2 text-gray-900 font-medium">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            {format(parseLocalDate(entry.txn_date), 'EEE MMM dd, yyyy')}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                            <Clock className="w-4 h-4 text-gray-400" />
                            {formatTimeRange(entry)}
                          </div>
                          <div className="text-sm font-semibold text-blue-600 mt-1">
                            {formatDuration(entry.hours, entry.minutes)}
                          </div>
                        </div>

                        {/* Details */}
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-gray-400" />
                              <span className="font-medium text-gray-900">{entry.employee_name}</span>
                            </div>
                            {/* Service Item Badge (click-to-edit) */}
                            {editingServiceItemId === entry.id ? (
                              <select
                                autoFocus
                                className="px-2 py-1 text-xs font-semibold rounded border border-purple-300 bg-white text-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-400"
                                value={entry.qb_item_id || ''}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    saveServiceItem(entry.id, e.target.value);
                                  }
                                  setEditingServiceItemId(null);
                                }}
                                onBlur={() => setEditingServiceItemId(null)}
                              >
                                <option value="" disabled>Select item...</option>
                                {serviceItems.map(si => (
                                  <option key={si.qb_item_id} value={si.qb_item_id}>
                                    {si.name}{si.code ? ` (${si.code})` : ''}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span
                                className={`px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded ${!entry.is_locked ? 'cursor-pointer hover:bg-purple-200' : ''}`}
                                onClick={() => { if (!entry.is_locked) setEditingServiceItemId(entry.id); }}
                                title={entry.is_locked ? 'Locked' : 'Click to change service item'}
                              >
                                {entry.service_item_name || entry.cost_code}
                              </span>
                            )}
                            {/* Billable Status Badge (click-to-edit) */}
                            {editingBillableId === entry.id ? (
                              <select
                                autoFocus
                                className="px-2 py-1 text-xs font-semibold rounded border border-green-300 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400"
                                value={entry.billable_status}
                                onChange={(e) => {
                                  saveBillableStatus(entry.id, e.target.value);
                                  setEditingBillableId(null);
                                }}
                                onBlur={() => setEditingBillableId(null)}
                              >
                                <option value="Billable">Billable</option>
                                <option value="NotBillable">Not Billable</option>
                              </select>
                            ) : (
                              <span
                                className={`px-2 py-1 text-xs font-semibold rounded ${
                                  entry.billable_status === 'Billable'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-700'
                                } ${!entry.is_locked ? 'cursor-pointer hover:opacity-80' : ''}`}
                                onClick={() => { if (!entry.is_locked) setEditingBillableId(entry.id); }}
                                title={entry.is_locked ? 'Locked' : 'Click to change billable status'}
                              >
                                {entry.billable_status}
                              </span>
                            )}
                            {/* Approval Status Badge */}
                            <span className={`px-2 py-1 text-xs font-semibold rounded ${
                              entry.approval_status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              entry.approval_status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                              entry.approval_status === 'sent' ? 'bg-blue-100 text-blue-700' :
                              entry.approval_status === 'delivered' ? 'bg-indigo-100 text-indigo-700' :
                              entry.approval_status === 'read' ? 'bg-purple-100 text-purple-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {entry.approval_status === 'pending' && '⏳ Pending'}
                              {entry.approval_status === 'approved' && '✅ Approved'}
                              {entry.approval_status === 'sent' && '📧 Sent'}
                              {entry.approval_status === 'delivered' && '📬 Delivered'}
                              {entry.approval_status === 'read' && '📖 Read'}
                              {!entry.approval_status && 'No Status'}
                            </span>
                            {/* Report Status Badge */}
                            {(() => {
                              const rs = getReportStatus(entry);
                              const effectiveStatus = rs || 'unbilled';
                              const styles: Record<string, string> = {
                                unbilled: 'bg-gray-50 text-gray-500 border-gray-200',
                                pending: 'bg-gray-50 text-gray-500 border-gray-200',
                                sent: 'bg-blue-50 text-blue-600 border-blue-200',
                                supplemental_sent: 'bg-blue-50 text-blue-600 border-blue-200',
                                accepted: 'bg-green-50 text-green-600 border-green-200',
                                disputed: 'bg-red-50 text-red-600 border-red-200',
                                no_time: 'bg-gray-50 text-gray-500 border-gray-200',
                              };
                              const labels: Record<string, string> = {
                                unbilled: 'Unbilled',
                                pending: 'Unbilled',
                                sent: 'Report Sent',
                                supplemental_sent: 'Supplemental',
                                accepted: 'Accepted',
                                disputed: 'Disputed',
                                no_time: 'No Time',
                              };
                              return (
                                <span data-testid="entry-status-badge" className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${styles[effectiveStatus] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                  {labels[effectiveStatus] || effectiveStatus}
                                </span>
                              );
                            })()}
                            <LockIcon
                              isLocked={entry.is_locked}
                              unlockedBy={entry.unlocked_by}
                              unlockedAt={entry.unlocked_at}
                              onToggle={() => handleLockToggle(entry)}
                            />
                            {/* Edited Badge */}
                            {entry.manually_edited && (
                              <span className="px-2 py-1 text-xs font-semibold rounded bg-amber-100 text-amber-700">
                                Edited
                              </span>
                            )}
                            {/* History Button */}
                            <button
                              onClick={() => {
                                setHistoryEntry(entry);
                                setHistoryDialogOpen(true);
                              }}
                              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                              title="View tracking history"
                            >
                              <History className="w-3 h-3" />
                              History
                            </button>
                            {/* Enhance Button */}
                            {!entry.is_locked && (
                              <button
                                onClick={() => {
                                  setEnhancingEntry(entry);
                                  setEnhanceDialogOpen(true);
                                }}
                                className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
                                title="Enhance notes with AI"
                              >
                                <Sparkles className="w-3 h-3" />
                                Enhance
                              </button>
                            )}
                            {/* Clarify Button */}
                            <button
                              onClick={() => {
                                setClarifyEntries([entry]);
                                setClarifyDialogOpen(true);
                              }}
                              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                              title="Request clarification"
                            >
                              <MessageSquare className="w-3 h-3" />
                              Clarify
                            </button>
                            {/* Active clarification badge */}
                            {entry.has_active_clarification && (
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" title="Clarification pending" />
                            )}
                          </div>

                          {/* Cost Code Description (read-only, from service_items) */}
                          {(serviceItemDescriptions[entry.cost_code] || serviceItemDescriptions[entry.service_item_name]) && (
                            <div className="text-sm text-gray-700 mb-1">
                              <span className="font-medium">Cost Code Description:</span> {serviceItemDescriptions[entry.cost_code] || serviceItemDescriptions[entry.service_item_name]}
                            </div>
                          )}

                          {/* Technician Notes (editable when unlocked) */}
                          <InlineNotesEditor
                            entryId={entry.id}
                            currentNotes={entry.notes}
                            isLocked={entry.is_locked}
                            isSaving={savingNotes}
                            onSave={saveNotes}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
    <TrackingHistoryDialog
      isOpen={historyDialogOpen}
      entryId={historyEntry?.id || null}
      entryDetails={historyEntry ? {
        employee_name: historyEntry.employee_name,
        txn_date: historyEntry.txn_date,
        hours: historyEntry.hours,
        minutes: historyEntry.minutes
      } : undefined}
      onClose={() => {
        setHistoryDialogOpen(false);
        setHistoryEntry(null);
      }}
    />

    <EnhanceNotesDialog
      isOpen={enhanceDialogOpen}
      entry={enhancingEntry}
      onAccept={saveNotes}
      onClose={() => {
        setEnhanceDialogOpen(false);
        setEnhancingEntry(null);
      }}
    />

    {/* Post-Approval Send Dialog */}
    {sendDialogOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="fixed inset-0 bg-black/50" onClick={() => !sendingFromDialog && sendFromDialog('skip')} />
        <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Entries Approved!
            </h3>
            <p className="text-emerald-100 text-sm mt-1">
              {sendDialogEntryIds.length} entries approved. Send the report now?
            </p>
          </div>
          <div className="p-6 space-y-3">
            <button
              onClick={() => sendFromDialog('test')}
              disabled={sendingFromDialog}
              className="w-full flex items-center gap-3 px-4 py-3 bg-amber-50 border-2 border-amber-200 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
            >
              <Send className="w-5 h-5 text-amber-600" />
              <div className="text-left">
                <p className="font-semibold text-amber-800">Send Test Report</p>
                <p className="text-xs text-amber-600">To Sharon Kisner & David Sweet for review</p>
              </div>
            </button>
            <button
              onClick={() => sendFromDialog('customer')}
              disabled={sendingFromDialog}
              className="w-full flex items-center gap-3 px-4 py-3 bg-emerald-50 border-2 border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
            >
              <Mail className="w-5 h-5 text-emerald-600" />
              <div className="text-left">
                <p className="font-semibold text-emerald-800">Send to Customer</p>
                <p className="text-xs text-emerald-600">To insured, CC Sharon & David</p>
              </div>
            </button>
            <button
              onClick={() => sendFromDialog('skip')}
              disabled={sendingFromDialog}
              className="w-full px-4 py-2 text-gray-500 hover:text-gray-700 text-sm transition-colors disabled:opacity-50"
            >
              Skip — Don't send now
            </button>
            {sendingFromDialog && (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                Sending...
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Change Reason Dialog — shown when unlocking a sent/accepted entry */}
    {changeReasonDialogOpen && changeReasonEntry && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="fixed inset-0 bg-black/50" onClick={() => setChangeReasonDialogOpen(false)} />
        <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
          <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4">
            <h3 className="text-lg font-bold text-white">Post-Send Edit Warning</h3>
            <p className="text-red-100 text-sm mt-1">
              This entry was previously sent to the customer
              {changeReasonEntry.sent_at && ` on ${new Date(changeReasonEntry.sent_at).toLocaleDateString()}`}.
            </p>
          </div>
          <div className="p-6">
            <p className="text-sm text-gray-700 mb-4">
              Any changes will be tracked and will require a <strong>supplemental report</strong> to be sent. Please provide a reason for the change.
            </p>
            <div className="space-y-2 mb-4">
              {[
                'Back time — work logged after report was sent',
                'Service category updated',
                'Description expanded',
                'Hours adjusted — detailed review',
              ].map((option) => (
                <label key={option} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="changeReason"
                    value={option}
                    checked={changeReason === option}
                    onChange={(e) => { setChangeReason(e.target.value); setChangeReasonCustom(''); }}
                    className="text-red-600"
                  />
                  <span className="text-sm text-gray-700">{option}</span>
                </label>
              ))}
              <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name="changeReason"
                  value="custom"
                  checked={changeReason === 'custom'}
                  onChange={() => setChangeReason('custom')}
                  className="text-red-600"
                />
                <span className="text-sm text-gray-700">Other (specify below)</span>
              </label>
              {changeReason === 'custom' && (
                <textarea
                  value={changeReasonCustom}
                  onChange={(e) => setChangeReasonCustom(e.target.value)}
                  placeholder="Describe the reason for the change..."
                  className="w-full mt-2 p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  rows={2}
                />
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setChangeReasonDialogOpen(false)}
                className="flex-1 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleChangeReasonSubmit}
                disabled={!changeReason || (changeReason === 'custom' && !changeReasonCustom.trim())}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Unlock & Track Change
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    <AssignClarificationDialog
      isOpen={clarifyDialogOpen}
      entries={clarifyEntries}
      adminEmail={user?.username || ''}
      onClose={() => {
        setClarifyDialogOpen(false);
        setClarifyEntries([]);
      }}
      onAssigned={() => {
        loadTimeEntries();
        setSelectedEntries(new Set());
      }}
    />

    </AppShell>
  );
}
