'use client';

import { useState, useEffect, useRef } from 'react';
import { Scale, X, Send, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase, callEdgeFunction } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';

interface Contact {
  name: string;
  email: string;
}

interface ReportData {
  customer: { name: string; id: string };
  dateRange: { start: string; end: string };
  invoices: any[];
  timeEntries: any[];
  summary: any;
}

interface SendCounselReportDialogProps {
  isOpen: boolean;
  reportData: ReportData;
  senderEmail: string;
  onClose: () => void;
  onSent: () => void;
}

const DEFAULT_CC = [
  'skisner@mitigationconsulting.com',
  'david@mitigationconsulting.com',
];

function EmailChipInput({
  emails,
  onChange,
  suggestions,
  placeholder,
  label,
}: {
  emails: string[];
  onChange: (emails: string[]) => void;
  suggestions: Contact[];
  placeholder: string;
  label: string;
}) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = inputValue.trim().length > 0
    ? suggestions.filter(
        c =>
          !emails.includes(c.email) &&
          (c.name.toLowerCase().includes(inputValue.toLowerCase()) ||
            c.email.toLowerCase().includes(inputValue.toLowerCase()))
      )
    : [];

  const addEmail = (email: string) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    if (emails.includes(trimmed)) return;
    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return;
    onChange([...emails, trimmed]);
    setInputValue('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const removeEmail = (email: string) => {
    onChange(emails.filter(e => e !== email));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      e.preventDefault();
      if (filtered.length === 1) {
        addEmail(filtered[0].email);
      } else if (inputValue.includes('@')) {
        addEmail(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && emails.length > 0) {
      removeEmail(emails[emails.length - 1]);
    }
  };

  // Close suggestions on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div
        className="flex flex-wrap gap-1.5 items-center px-3 py-2 border border-gray-300 rounded-lg bg-white min-h-[42px] cursor-text focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
        onClick={() => inputRef.current?.focus()}
      >
        {emails.map(email => (
          <span
            key={email}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md text-sm font-medium"
          >
            {email}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeEmail(email); }}
              className="text-blue-600 hover:text-blue-800"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder={emails.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] outline-none text-sm bg-transparent"
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.slice(0, 10).map(contact => (
            <button
              key={contact.email}
              type="button"
              className="w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors flex items-center justify-between"
              onClick={() => addEmail(contact.email)}
            >
              <div>
                <div className="text-sm font-medium text-gray-900">{contact.name}</div>
                <div className="text-xs text-gray-500">{contact.email}</div>
              </div>
              <Plus className="w-4 h-4 text-gray-400" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SendCounselReportDialog({
  isOpen,
  reportData,
  senderEmail,
  onClose,
  onSent,
}: SendCounselReportDialogProps) {
  const [toRecipients, setToRecipients] = useState<string[]>([]);
  const [ccRecipients, setCcRecipients] = useState<string[]>(DEFAULT_CC);
  const [bccRecipients, setBccRecipients] = useState<string[]>([]);
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Load contacts on mount
  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      const { data } = await supabase
        .from('customers')
        .select('display_name, email')
        .eq('is_active', true)
        .not('email', 'is', null)
        .order('display_name');

      const customerContacts: Contact[] = (data || []).map(c => ({
        name: c.display_name,
        email: c.email,
      }));

      // Add known internal contacts
      const internal: Contact[] = [
        { name: 'Sharon Kissner', email: 'skisner@mitigationconsulting.com' },
        { name: 'David Sweet', email: 'david@mitigationconsulting.com' },
        { name: 'MIT Accounting', email: 'accounting@mitigationconsulting.com' },
      ];

      // Deduplicate
      const all = [...internal, ...customerContacts];
      const seen = new Set<string>();
      const unique = all.filter(c => {
        if (seen.has(c.email)) return false;
        seen.add(c.email);
        return true;
      });

      setContacts(unique);
    };
    load();
  }, [isOpen]);

  // Set default subject when report data changes
  useEffect(() => {
    if (reportData?.customer?.name) {
      setSubject(`Comprehensive Billing Summary — ${reportData.customer.name}`);
    }
  }, [reportData?.customer?.name]);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setToRecipients([]);
      setCcRecipients(DEFAULT_CC);
      setBccRecipients([]);
      setShowBcc(false);
      setSending(false);
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (toRecipients.length === 0) {
      toast.error('Add at least one recipient');
      return;
    }

    setSending(true);
    try {
      const result = await callEdgeFunction('send-counsel-report', {
        to: toRecipients,
        cc: ccRecipients,
        bcc: bccRecipients.length > 0 ? bccRecipients : undefined,
        subject,
        reportData,
        sentBy: senderEmail,
      });

      if (!result.success) {
        throw new Error(result.error || 'Send failed');
      }

      toast.success(`Report sent to ${result.recipientCount} recipient${result.recipientCount > 1 ? 's' : ''}`);
      onSent();
    } catch (err) {
      toast.error(`Failed to send: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={() => !sending && onClose()} />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Scale className="w-5 h-5 text-white" />
            <div>
              <h3 className="text-lg font-bold text-white">Send Billing Report</h3>
              <p className="text-blue-200 text-sm">{reportData.customer.name}</p>
            </div>
          </div>
          <button
            onClick={() => !sending && onClose()}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <EmailChipInput
            emails={toRecipients}
            onChange={setToRecipients}
            suggestions={contacts}
            placeholder="Type a name or email address..."
            label="To"
          />

          <EmailChipInput
            emails={ccRecipients}
            onChange={setCcRecipients}
            suggestions={contacts}
            placeholder="Add CC recipients..."
            label="CC"
          />

          {showBcc ? (
            <EmailChipInput
              emails={bccRecipients}
              onChange={setBccRecipients}
              suggestions={contacts}
              placeholder="Add BCC recipients..."
              label="BCC"
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowBcc(true)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add BCC
            </button>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Preview info */}
          <div className="bg-gray-50 rounded-lg p-4 text-sm">
            <p className="font-medium text-gray-700 mb-2">Report includes:</p>
            <ul className="text-gray-600 space-y-1 text-xs">
              <li>{reportData.invoices.length} invoice{reportData.invoices.length !== 1 ? 's' : ''} &middot; ${reportData.summary.totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2 })}</li>
              <li>{reportData.summary.totalHours.toFixed(1)} total hours &middot; {reportData.timeEntries.length} time records</li>
              <li>Period: {reportData.dateRange.start} to {reportData.dateRange.end}</li>
            </ul>
            <p className="text-xs text-gray-500 mt-2 italic">
              No descriptions or notes are included — work product protection applied.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <button
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || toRecipients.length === 0}
            className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send Report
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
