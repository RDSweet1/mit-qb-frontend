'use client';

import { useState, useEffect } from 'react';
import { X, Send, FileText } from 'lucide-react';
import { format, endOfWeek } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';

interface PreviewEntry {
  employee_name: string;
  qb_customer_id: string;
  hours: number;
  minutes: number;
  cost_code: string;
  txn_date: string;
}

interface ReportPreviewModalProps {
  isOpen: boolean;
  selectedWeek: string;
  sending: boolean;
  onSend: () => void;
  onClose: () => void;
}

export function ReportPreviewModal({ isOpen, selectedWeek, sending, onSend, onClose }: ReportPreviewModalProps) {
  const [entries, setEntries] = useState<PreviewEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !selectedWeek) return;
    setLoading(true);
    const weekStart = selectedWeek;
    const weekEnd = format(endOfWeek(new Date(weekStart), { weekStartsOn: 1 }), 'yyyy-MM-dd');

    supabase
      .from('time_entries')
      .select('employee_name, qb_customer_id, hours, minutes, cost_code, txn_date')
      .gte('txn_date', weekStart)
      .lte('txn_date', weekEnd)
      .eq('billable_status', 'Billable')
      .order('qb_customer_id')
      .order('txn_date')
      .then(({ data }) => {
        setEntries(data || []);
        setLoading(false);
      });
  }, [isOpen, selectedWeek]);

  if (!isOpen) return null;

  const weekStart = new Date(selectedWeek);
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const totalHours = entries.reduce((sum, e) => sum + e.hours + e.minutes / 60, 0);
  const customerCount = new Set(entries.map(e => e.qb_customer_id)).size;

  // Group by customer
  const byCustomer = new Map<string, PreviewEntry[]>();
  entries.forEach(e => {
    if (!byCustomer.has(e.qb_customer_id)) byCustomer.set(e.qb_customer_id, []);
    byCustomer.get(e.qb_customer_id)!.push(e);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden max-h-[80vh] flex flex-col">
        <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Report Preview
            </h3>
            <p className="text-green-100 text-sm mt-1">
              Week of {format(weekStart, 'MMM d')} &ndash; {format(weekEnd, 'MMM d, yyyy')}
            </p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{customerCount}</p>
              <p className="text-xs text-green-600 uppercase">Customers</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-blue-700">{entries.length}</p>
              <p className="text-xs text-blue-600 uppercase">Entries</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-purple-700">{totalHours.toFixed(1)}</p>
              <p className="text-xs text-purple-600 uppercase">Total Hours</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-2" />
              Loading entries...
            </div>
          ) : entries.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No billable entries found for this week.</p>
          ) : (
            <div className="space-y-4">
              {Array.from(byCustomer.entries()).map(([customerId, custEntries]) => {
                const custHours = custEntries.reduce((sum, e) => sum + e.hours + e.minutes / 60, 0);
                return (
                  <div key={customerId} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
                      <span className="font-medium text-gray-900 text-sm">{customerId}</span>
                      <span className="text-xs text-gray-600">{custEntries.length} entries &bull; {custHours.toFixed(1)} hrs</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                          <th className="px-4 py-1">Date</th>
                          <th className="px-4 py-1">Employee</th>
                          <th className="px-4 py-1">Cost Code</th>
                          <th className="px-4 py-1 text-right">Hours</th>
                        </tr>
                      </thead>
                      <tbody>
                        {custEntries.map((e, i) => (
                          <tr key={i} className="border-b border-gray-50">
                            <td className="px-4 py-1 text-gray-700">{e.txn_date}</td>
                            <td className="px-4 py-1 text-gray-700">{e.employee_name}</td>
                            <td className="px-4 py-1 text-gray-700">{e.cost_code}</td>
                            <td className="px-4 py-1 text-right text-gray-700">{(e.hours + e.minutes / 60).toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 px-6 py-4 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">
            Cancel
          </button>
          <button
            onClick={onSend}
            disabled={sending || entries.length === 0}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send to {customerCount} Customer{customerCount !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
