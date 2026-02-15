'use client';

import { CheckCircle, Send, Mail } from 'lucide-react';

interface SendDialogProps {
  isOpen: boolean;
  entryCount: number;
  sending: boolean;
  onSend: (mode: 'test' | 'customer' | 'skip') => void;
}

export function SendDialog({ isOpen, entryCount, sending, onSend }: SendDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={() => !sending && onSend('skip')} />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Entries Approved!
          </h3>
          <p className="text-emerald-100 text-sm mt-1">
            {entryCount} entries approved. Send the report now?
          </p>
        </div>
        <div className="p-6 space-y-3">
          <button
            onClick={() => onSend('test')}
            disabled={sending}
            className="w-full flex items-center gap-3 px-4 py-3 bg-amber-50 border-2 border-amber-200 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
          >
            <Send className="w-5 h-5 text-amber-600" />
            <div className="text-left">
              <p className="font-semibold text-amber-800">Send Test Report</p>
              <p className="text-xs text-amber-600">To Sharon Kisner & David Sweet for review</p>
            </div>
          </button>
          <button
            onClick={() => onSend('customer')}
            disabled={sending}
            className="w-full flex items-center gap-3 px-4 py-3 bg-emerald-50 border-2 border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
          >
            <Mail className="w-5 h-5 text-emerald-600" />
            <div className="text-left">
              <p className="font-semibold text-emerald-800">Send to Customer</p>
              <p className="text-xs text-emerald-600">To insured, CC Sharon & David</p>
            </div>
          </button>
          <button
            onClick={() => onSend('skip')}
            disabled={sending}
            className="w-full px-4 py-2 text-gray-500 hover:text-gray-700 text-sm transition-colors disabled:opacity-50"
          >
            Skip &mdash; Don&apos;t send now
          </button>
          {sending && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              Sending...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
