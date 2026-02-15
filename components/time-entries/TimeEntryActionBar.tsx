'use client';

import { CheckCircle, X, FileText, Mail, MessageSquare, Wrench, SendHorizonal } from 'lucide-react';
import type { TimeEntry } from '@/lib/types';

interface TimeEntryActionBarProps {
  entries: TimeEntry[];
  selectedEntries: Set<number>;
  approvingEntries: boolean;
  testMode: boolean;
  onApproveSelected: () => void;
  onApproveAll: () => void;
  onApproveAndSend: () => void;
  onClarifySelected: () => void;
  onBatchServiceItem: () => void;
  onDeselectAll: () => void;
  onGenerateReport: () => void;
  onToggleTestMode: () => void;
  onSendReport: () => void;
  selectedCustomer: string;
  calculateTotalHours: (entries: TimeEntry[]) => string;
}

export function TimeEntryActionBar({
  entries,
  selectedEntries,
  approvingEntries,
  testMode,
  onApproveSelected,
  onApproveAll,
  onApproveAndSend,
  onClarifySelected,
  onBatchServiceItem,
  onDeselectAll,
  onGenerateReport,
  onToggleTestMode,
  onSendReport,
  selectedCustomer,
  calculateTotalHours,
}: TimeEntryActionBarProps) {
  const pendingCount = entries.filter(e => e.approval_status === 'pending').length;

  return (
    <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">
            Total Entries: <span className="font-semibold text-gray-900">{entries.length}</span>
          </p>
          <p className="text-sm text-gray-600">
            Total Hours: <span className="font-semibold text-gray-900">{calculateTotalHours(entries)} hrs</span>
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {/* Approval Buttons Row */}
          <div className="flex gap-2">
            <button
              onClick={onApproveSelected}
              disabled={selectedEntries.size === 0 || approvingEntries}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={selectedEntries.size === 0 ? 'Select entries to approve' : `Approve ${selectedEntries.size} selected entries`}
            >
              <CheckCircle className="w-4 h-4" />
              Approve Selected ({selectedEntries.size})
            </button>
            <button
              onClick={onApproveAll}
              disabled={approvingEntries || pendingCount === 0}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Approve all pending entries for current filter"
            >
              <CheckCircle className="w-4 h-4" />
              Approve All Pending
            </button>
            {selectedEntries.size > 0 && (
              <>
                <button
                  onClick={onApproveAndSend}
                  disabled={selectedEntries.size === 0 || approvingEntries}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={`Approve & send ${selectedEntries.size} selected entries`}
                >
                  <SendHorizonal className="w-4 h-4" />
                  Approve & Send
                </button>
                <button
                  onClick={onBatchServiceItem}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  title={`Set service item for ${selectedEntries.size} selected entries`}
                >
                  <Wrench className="w-4 h-4" />
                  Set Service Item
                </button>
                <button
                  onClick={onClarifySelected}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                  title={`Request clarification for ${selectedEntries.size} selected entries`}
                >
                  <MessageSquare className="w-4 h-4" />
                  Clarify ({selectedEntries.size})
                </button>
                <button
                  onClick={onDeselectAll}
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
            onClick={onGenerateReport}
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
                onClick={onToggleTestMode}
                className={`relative w-10 h-6 rounded-full transition-colors ${testMode ? 'bg-amber-500' : 'bg-emerald-500'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${testMode ? 'translate-x-0.5' : 'translate-x-4'}`} />
              </div>
              <span className={`text-xs font-semibold ${testMode ? 'text-amber-700' : 'text-emerald-700'}`}>
                {testMode ? 'TEST MODE \u2014 sends to David & Sharon' : 'LIVE \u2014 sends to customer + CC Sharon & David'}
              </span>
            </label>

            <button
              onClick={onSendReport}
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
  );
}
