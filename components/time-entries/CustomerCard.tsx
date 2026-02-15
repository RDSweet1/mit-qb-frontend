'use client';

import { Building2, ChevronDown, ChevronRight } from 'lucide-react';
import type { TimeEntry, ServiceItem, ReportPeriod } from '@/lib/types';
import { TimeEntryRow } from './TimeEntryRow';

interface CustomerCardProps {
  customerId: string;
  customerName: string;
  entries: TimeEntry[];
  selectedEntries: Set<number>;
  isCollapsed: boolean;
  onToggleCollapse: (customerId: string) => void;
  onToggleSelection: (id: number) => void;
  onSelectAllInCard: (customerId: string, entryIds: number[], allSelected: boolean) => void;
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
  calculateTotalHours: (entries: TimeEntry[]) => string;
  startDate: string;
  endDate: string;
}

export function CustomerCard({
  customerId,
  customerName,
  entries,
  selectedEntries,
  isCollapsed: isCollapsedProp,
  onToggleCollapse,
  onToggleSelection,
  onSelectAllInCard,
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
  calculateTotalHours,
  startDate,
  endDate,
}: CustomerCardProps) {
  const allSent = entries.every(e => e.approval_status === 'sent' || e.approval_status === 'delivered' || e.approval_status === 'read');
  const allApproved = entries.every(e => e.approval_status === 'approved' || e.approval_status === 'sent' || e.approval_status === 'delivered' || e.approval_status === 'read');
  const someApproved = entries.some(e => e.approval_status === 'approved' || e.approval_status === 'sent');
  const isCollapsed = isCollapsedProp || allSent;
  const isExpanded = !isCollapsed;
  const allSelectedInCard = entries.every(e => selectedEntries.has(e.id));
  const someSelectedInCard = entries.some(e => selectedEntries.has(e.id));

  const headerGradient = allSent
    ? 'from-emerald-600 to-emerald-700'
    : allApproved
    ? 'from-amber-500 to-amber-600'
    : 'from-blue-600 to-blue-700';

  return (
    <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Customer Header */}
      <div
        className={`bg-gradient-to-r ${headerGradient} px-6 py-4 cursor-pointer select-none`}
        onClick={() => onToggleCollapse(customerId)}
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
                {entries.length} entries &bull; {calculateTotalHours(entries)} hours
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {allSent && (
              <span className="px-3 py-1 bg-white/20 text-white text-xs font-bold rounded-full">
                Sent {startDate} &ndash; {endDate}
              </span>
            )}
            {!allSent && allApproved && (
              <span className="px-3 py-1 bg-white/20 text-white text-xs font-bold rounded-full">
                Approved &mdash; Not Sent
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
                  const ids = entries.map(en => en.id);
                  onSelectAllInCard(customerId, ids, allSelectedInCard);
                }}
                className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${
                  allSelectedInCard
                    ? 'bg-white text-blue-700 hover:bg-blue-50'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                {allSelectedInCard ? '\u2713 All Selected' : someSelectedInCard ? `Select All (${entries.filter(e => selectedEntries.has(e.id)).length}/${entries.length})` : 'Select All'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Time Entries */}
      {isExpanded && (
        <>
          <div className="divide-y divide-gray-200">
            {entries.map((entry) => (
              <TimeEntryRow
                key={entry.id}
                entry={entry}
                isSelected={selectedEntries.has(entry.id)}
                onToggleSelection={onToggleSelection}
                onLockToggle={onLockToggle}
                onHistoryClick={onHistoryClick}
                onEnhanceClick={onEnhanceClick}
                onClarifyClick={onClarifyClick}
                onSaveNotes={onSaveNotes}
                onSaveServiceItem={onSaveServiceItem}
                onSaveBillableStatus={onSaveBillableStatus}
                savingNotes={savingNotes}
                serviceItems={serviceItems}
                serviceItemDescriptions={serviceItemDescriptions}
                editingServiceItemId={editingServiceItemId}
                editingBillableId={editingBillableId}
                onSetEditingServiceItemId={onSetEditingServiceItemId}
                onSetEditingBillableId={onSetEditingBillableId}
                getReportStatus={getReportStatus}
              />
            ))}
          </div>
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Total for {customerName}</span>
              <span className="text-lg font-bold text-gray-900">{calculateTotalHours(entries)} hours</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
