'use client';

import { Calendar, Clock, User, History, Sparkles, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import type { TimeEntry, ServiceItem, ReportPeriod } from '@/lib/types';
import { LockIcon } from './LockIcon';
import { InlineNotesEditor } from './InlineNotesEditor';

interface TimeEntryRowProps {
  entry: TimeEntry;
  isSelected: boolean;
  onToggleSelection: (id: number) => void;
  onLockToggle: (entry: TimeEntry) => void;
  onHistoryClick: (entry: TimeEntry) => void;
  onEnhanceClick: (entry: TimeEntry) => void;
  onClarifyClick: (entries: TimeEntry[]) => void;
  onSaveNotes: (entryId: number, notes: string) => Promise<void>;
  onSaveServiceItem: (entryId: number, qbItemId: string) => void;
  onSaveBillableStatus: (entryId: number, status: string) => void;
  savingNotes: boolean;
  serviceItems: ServiceItem[];
  serviceItemDescriptions: Record<string, string>;
  editingServiceItemId: number | null;
  editingBillableId: number | null;
  onSetEditingServiceItemId: (id: number | null) => void;
  onSetEditingBillableId: (id: number | null) => void;
  getReportStatus: (entry: TimeEntry) => ReportPeriod['status'] | null;
}

function parseLocalDate(dateString: string) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatTimeRange(entry: TimeEntry) {
  if (entry.start_time && entry.end_time) {
    const startDate = entry.start_time.includes('T')
      ? new Date(entry.start_time)
      : new Date(`2000-01-01T${entry.start_time}`);
    const endDate = entry.end_time.includes('T')
      ? new Date(entry.end_time)
      : new Date(`2000-01-01T${entry.end_time}`);
    return `${format(startDate, 'h:mm a')} - ${format(endDate, 'h:mm a')}`;
  }
  return 'Lump sum entry';
}

function formatDuration(hours: number, minutes: number) {
  return `${hours}.${minutes.toString().padStart(2, '0')} hrs`;
}

const approvalStyles: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-emerald-100 text-emerald-700',
  sent: 'bg-blue-100 text-blue-700',
  delivered: 'bg-indigo-100 text-indigo-700',
  read: 'bg-purple-100 text-purple-700',
};

const approvalLabels: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
};

const reportStyles: Record<string, string> = {
  unbilled: 'bg-gray-50 text-gray-500 border-gray-200',
  pending: 'bg-gray-50 text-gray-500 border-gray-200',
  sent: 'bg-blue-50 text-blue-600 border-blue-200',
  supplemental_sent: 'bg-blue-50 text-blue-600 border-blue-200',
  accepted: 'bg-green-50 text-green-600 border-green-200',
  disputed: 'bg-red-50 text-red-600 border-red-200',
  no_time: 'bg-gray-50 text-gray-500 border-gray-200',
};

const reportLabels: Record<string, string> = {
  unbilled: 'Unbilled',
  pending: 'Unbilled',
  sent: 'Report Sent',
  supplemental_sent: 'Supplemental',
  accepted: 'Accepted',
  disputed: 'Disputed',
  no_time: 'No Time',
};

export function TimeEntryRow({
  entry,
  isSelected,
  onToggleSelection,
  onLockToggle,
  onHistoryClick,
  onEnhanceClick,
  onClarifyClick,
  onSaveNotes,
  onSaveServiceItem,
  onSaveBillableStatus,
  savingNotes,
  serviceItems,
  serviceItemDescriptions,
  editingServiceItemId,
  editingBillableId,
  onSetEditingServiceItemId,
  onSetEditingBillableId,
  getReportStatus,
}: TimeEntryRowProps) {
  const reportStatus = getReportStatus(entry);
  const effectiveReportStatus = reportStatus || 'unbilled';

  return (
    <div className="px-6 py-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-4">
        {/* Checkbox */}
        <div className="flex-shrink-0 pt-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelection(entry.id)}
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
          <div className="flex items-center gap-3 mb-2 flex-wrap">
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
                    onSaveServiceItem(entry.id, e.target.value);
                  }
                  onSetEditingServiceItemId(null);
                }}
                onBlur={() => onSetEditingServiceItemId(null)}
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
                onClick={() => { if (!entry.is_locked) onSetEditingServiceItemId(entry.id); }}
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
                  onSaveBillableStatus(entry.id, e.target.value);
                  onSetEditingBillableId(null);
                }}
                onBlur={() => onSetEditingBillableId(null)}
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
                onClick={() => { if (!entry.is_locked) onSetEditingBillableId(entry.id); }}
                title={entry.is_locked ? 'Locked' : 'Click to change billable status'}
              >
                {entry.billable_status}
              </span>
            )}
            {/* Approval Status Badge */}
            <span className={`px-2 py-1 text-xs font-semibold rounded ${
              approvalStyles[entry.approval_status] || 'bg-gray-100 text-gray-700'
            }`}>
              {approvalLabels[entry.approval_status] || 'No Status'}
            </span>
            {/* Report Status Badge */}
            <span
              data-testid="entry-status-badge"
              className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${
                reportStyles[effectiveReportStatus] || 'bg-gray-50 text-gray-500 border-gray-200'
              }`}
            >
              {reportLabels[effectiveReportStatus] || effectiveReportStatus}
            </span>
            <LockIcon
              isLocked={entry.is_locked}
              unlockedBy={entry.unlocked_by}
              unlockedAt={entry.unlocked_at}
              onToggle={() => onLockToggle(entry)}
            />
            {/* Edited Badge */}
            {entry.manually_edited && (
              <span className="px-2 py-1 text-xs font-semibold rounded bg-amber-100 text-amber-700">
                Edited
              </span>
            )}
            {/* History Button */}
            <button
              onClick={() => onHistoryClick(entry)}
              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              title="View tracking history"
            >
              <History className="w-3 h-3" />
              History
            </button>
            {/* Enhance Button */}
            {!entry.is_locked && (
              <button
                onClick={() => onEnhanceClick(entry)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
                title="Enhance notes with AI"
              >
                <Sparkles className="w-3 h-3" />
                Enhance
              </button>
            )}
            {/* Clarify Button */}
            <button
              onClick={() => onClarifyClick([entry])}
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

          {/* Cost Code Description */}
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
            onSave={onSaveNotes}
          />
        </div>
      </div>
    </div>
  );
}
