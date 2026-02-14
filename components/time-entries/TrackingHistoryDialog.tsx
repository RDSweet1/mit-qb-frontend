'use client';

import { useState, useEffect } from 'react';
import { X, Clock, CheckCircle, Mail, Inbox, Eye, XCircle, User } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Modal } from '@/components/Modal';

interface AuditLogEntry {
  id: number;
  action: string;
  performed_by: string;
  performed_at: string;
  details: any;
}

interface TrackingHistoryDialogProps {
  isOpen: boolean;
  entryId: number | null;
  entryDetails?: {
    employee_name: string;
    txn_date: string;
    hours: number;
    minutes: number;
  };
  onClose: () => void;
}

export function TrackingHistoryDialog({
  isOpen,
  entryId,
  entryDetails,
  onClose
}: TrackingHistoryDialogProps) {
  const [history, setHistory] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && entryId) {
      loadHistory();
    }
  }, [isOpen, entryId]);

  const loadHistory = async () => {
    if (!entryId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('approval_audit_log')
        .select('*')
        .eq('time_entry_id', entryId)
        .order('performed_at', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-emerald-600" />;
      case 'sent':
        return <Mail className="w-5 h-5 text-blue-600" />;
      case 'delivered':
        return <Inbox className="w-5 h-5 text-indigo-600" />;
      case 'read':
        return <Eye className="w-5 h-5 text-purple-600" />;
      case 'declined_read':
        return <XCircle className="w-5 h-5 text-orange-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'approved':
        return 'Approved';
      case 'sent':
        return 'Sent to Customer';
      case 'delivered':
        return 'Delivered';
      case 'read':
        return 'Read by Customer';
      case 'declined_read':
        return 'Read Receipt Declined';
      case 'unlock':
        return 'Unlocked';
      case 'lock':
        return 'Locked';
      case 'edit':
        return 'Edited';
      default:
        return action;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title="Tracking History"
      footer={
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Close
        </button>
      }
    >
      {/* Entry subtitle */}
      {entryDetails && (
        <div className="mb-4 text-sm text-gray-600">
          {entryDetails.employee_name} &bull; {entryDetails.txn_date} &bull; {entryDetails.hours}h {entryDetails.minutes}m
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No tracking history available</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Timeline */}
          <div className="relative">
            {history.map((entry, index) => (
              <div key={entry.id} className="relative pb-8 last:pb-0">
                {/* Timeline line */}
                {index !== history.length - 1 && (
                  <div className="absolute left-[18px] top-8 bottom-0 w-0.5 bg-gray-200" />
                )}

                <div className="flex gap-4">
                  {/* Icon */}
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center">
                    {getActionIcon(entry.action)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {getActionLabel(entry.action)}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          <User className="w-3 h-3 inline mr-1" />
                          {entry.performed_by}
                        </p>
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatDate(entry.performed_at)}
                      </span>
                    </div>

                    {/* Details */}
                    {entry.details && Object.keys(entry.details).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <details className="text-xs">
                          <summary className="cursor-pointer text-gray-600 hover:text-gray-900 font-medium">
                            View Details
                          </summary>
                          <div className="mt-2 space-y-1 text-gray-600 bg-white p-2 rounded">
                            {Object.entries(entry.details).map(([key, value]) => (
                              <div key={key} className="flex gap-2">
                                <span className="font-medium">{key}:</span>
                                <span className="break-all">
                                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
