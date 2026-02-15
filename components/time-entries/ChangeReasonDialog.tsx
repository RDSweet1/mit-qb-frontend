'use client';

import { useState } from 'react';
import type { TimeEntry } from '@/lib/types';

interface ChangeReasonDialogProps {
  isOpen: boolean;
  entry: TimeEntry | null;
  onSubmit: (entry: TimeEntry, reason: string) => void;
  onClose: () => void;
}

const REASON_OPTIONS = [
  'Back time \u2014 work logged after report was sent',
  'Service category updated',
  'Description expanded',
  'Hours adjusted \u2014 detailed review',
];

export function ChangeReasonDialog({ isOpen, entry, onSubmit, onClose }: ChangeReasonDialogProps) {
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  if (!isOpen || !entry) return null;

  const handleSubmit = () => {
    const finalReason = reason === 'custom' ? customReason : reason;
    if (!finalReason.trim()) return;
    onSubmit(entry, finalReason);
    setReason('');
    setCustomReason('');
  };

  const isValid = reason && (reason !== 'custom' || customReason.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4">
          <h3 className="text-lg font-bold text-white">Post-Send Edit Warning</h3>
          <p className="text-red-100 text-sm mt-1">
            This entry was previously sent to the customer
            {entry.sent_at && ` on ${new Date(entry.sent_at).toLocaleDateString()}`}.
          </p>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-700 mb-4">
            Any changes will be tracked and will require a <strong>supplemental report</strong> to be sent. Please provide a reason for the change.
          </p>
          <div className="space-y-2 mb-4">
            {REASON_OPTIONS.map((option) => (
              <label key={option} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name="changeReason"
                  value={option}
                  checked={reason === option}
                  onChange={(e) => { setReason(e.target.value); setCustomReason(''); }}
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
                checked={reason === 'custom'}
                onChange={() => setReason('custom')}
                className="text-red-600"
              />
              <span className="text-sm text-gray-700">Other (specify below)</span>
            </label>
            {reason === 'custom' && (
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Describe the reason for the change..."
                className="w-full mt-2 p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
                rows={2}
              />
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isValid}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Unlock & Track Change
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
