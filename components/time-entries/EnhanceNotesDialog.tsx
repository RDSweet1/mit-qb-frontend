'use client';

import { useState, useEffect } from 'react';
import { X, Sparkles, Check } from 'lucide-react';
import { callEdgeFunction } from '@/lib/supabaseClient';

interface EnhanceNotesDialogProps {
  isOpen: boolean;
  entry: {
    id: number;
    notes: string | null;
    description: string | null;
    employee_name: string;
    qb_customer_id: string;
    cost_code: string;
    service_item_name: string;
    hours: number;
    minutes: number;
    txn_date: string;
  } | null;
  onAccept: (entryId: number, enhancedNotes: string) => Promise<void>;
  onClose: () => void;
}

export function EnhanceNotesDialog({
  isOpen,
  entry,
  onAccept,
  onClose,
}: EnhanceNotesDialogProps) {
  const [enhancedNotes, setEnhancedNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && entry) {
      enhanceNotes();
    }
  }, [isOpen, entry?.id]);

  const enhanceNotes = async () => {
    if (!entry) return;

    setLoading(true);
    setError(null);
    setEnhancedNotes('');

    try {
      const result = await callEdgeFunction('enhance_notes', {
        notes: entry.notes,
        description: entry.description,
        employee_name: entry.employee_name,
        customer: entry.qb_customer_id,
        cost_code: entry.cost_code,
        service_item_name: entry.service_item_name,
        hours: entry.hours,
        minutes: entry.minutes,
        date: entry.txn_date,
      });

      if (result.success) {
        setEnhancedNotes(result.enhanced_notes);
      } else {
        setError(result.error || 'Enhancement failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enhance notes');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!entry || !enhancedNotes) return;

    setSaving(true);
    try {
      await onAccept(entry.id, enhancedNotes);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !entry) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Dialog */}
        <div className="relative bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-white" />
              <div>
                <h2 className="text-xl font-bold text-white">AI Note Enhancement</h2>
                <p className="text-purple-100 text-sm mt-1">
                  {entry.employee_name} - {entry.txn_date} - {entry.hours}h {entry.minutes}m
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-purple-800 rounded-lg p-2 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(80vh-180px)]">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Original Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Original Notes
                </label>
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 min-h-[120px]">
                  {entry.notes || entry.description || 'No notes available'}
                </div>
              </div>

              {/* AI Suggestion */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  AI Suggestion
                  <span className="text-xs font-normal text-gray-500 ml-1">(editable)</span>
                </label>
                {loading ? (
                  <div className="flex items-center justify-center p-8 bg-purple-50 border border-purple-200 rounded-lg min-h-[120px]">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3"></div>
                      <p className="text-sm text-purple-600">Generating enhanced notes...</p>
                    </div>
                  </div>
                ) : (
                  <textarea
                    value={enhancedNotes}
                    onChange={(e) => setEnhancedNotes(e.target.value)}
                    className="w-full p-3 border border-purple-200 rounded-lg text-sm text-gray-700 min-h-[120px] focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-y"
                    placeholder="AI-generated suggestion will appear here..."
                  />
                )}
              </div>
            </div>

            <p className="mt-4 text-xs text-gray-500 italic">
              AI-generated content should be reviewed before saving. The suggestion is based on the original notes and entry context.
            </p>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={enhanceNotes}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-2 text-sm text-purple-700 bg-purple-100 rounded-lg hover:bg-purple-200 transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              Regenerate
            </button>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAccept}
                disabled={loading || saving || !enhancedNotes}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {saving ? 'Saving...' : 'Accept & Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
