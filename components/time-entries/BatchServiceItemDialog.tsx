'use client';

import { useState } from 'react';
import { Wrench, X } from 'lucide-react';
import type { ServiceItem } from '@/lib/types';

interface BatchServiceItemDialogProps {
  isOpen: boolean;
  entryCount: number;
  serviceItems: ServiceItem[];
  onAssign: (qbItemId: string) => void;
  onClose: () => void;
}

export function BatchServiceItemDialog({
  isOpen,
  entryCount,
  serviceItems,
  onAssign,
  onClose,
}: BatchServiceItemDialogProps) {
  const [selectedItemId, setSelectedItemId] = useState('');

  if (!isOpen) return null;

  const handleAssign = () => {
    if (!selectedItemId) return;
    onAssign(selectedItemId);
    setSelectedItemId('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Wrench className="w-5 h-5" />
              Set Service Item
            </h3>
            <button onClick={onClose} className="text-white/80 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-purple-100 text-sm mt-1">
            Assign a service item to {entryCount} selected {entryCount === 1 ? 'entry' : 'entries'}
          </p>
        </div>
        <div className="p-6">
          <select
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 mb-4"
          >
            <option value="">Select a service item...</option>
            {serviceItems.map(si => (
              <option key={si.qb_item_id} value={si.qb_item_id}>
                {si.name}{si.code ? ` (${si.code})` : ''}
              </option>
            ))}
          </select>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">
              Cancel
            </button>
            <button
              onClick={handleAssign}
              disabled={!selectedItemId}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Assign to {entryCount} {entryCount === 1 ? 'Entry' : 'Entries'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
