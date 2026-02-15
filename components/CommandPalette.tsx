'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Clock, FileText, DollarSign, TrendingUp, Settings, Users, BarChart3, MessageSquare, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useKeyboardShortcuts } from '@/lib/hooks/useKeyboardShortcuts';

interface CommandItem {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  keywords: string[];
}

const COMMANDS: CommandItem[] = [
  { id: 'time', label: 'Time Entries', description: 'View and manage time entries', href: '/time-entries-enhanced', icon: <Clock className="w-4 h-4" />, keywords: ['time', 'entries', 'timesheet', 'hours'] },
  { id: 'reports', label: 'Weekly Reports', description: 'Generate and send reports', href: '/reports', icon: <FileText className="w-4 h-4" />, keywords: ['reports', 'weekly', 'send', 'email'] },
  { id: 'invoices', label: 'Invoices', description: 'Create invoices in QuickBooks', href: '/invoices', icon: <DollarSign className="w-4 h-4" />, keywords: ['invoices', 'billing', 'quickbooks'] },
  { id: 'profitability', label: 'Profitability', description: 'P&L trends and overhead', href: '/profitability', icon: <TrendingUp className="w-4 h-4" />, keywords: ['profit', 'profitability', 'margin', 'pnl', 'overhead'] },
  { id: 'overhead', label: 'Overhead', description: 'Manage overhead categories', href: '/overhead', icon: <BarChart3 className="w-4 h-4" />, keywords: ['overhead', 'expenses', 'categories'] },
  { id: 'unbilled', label: 'Unbilled Time', description: 'Find entries missing cost codes', href: '/analytics/unbilled-time', icon: <BarChart3 className="w-4 h-4" />, keywords: ['unbilled', 'missing', 'cost code', 'analytics'] },
  { id: 'clarifications', label: 'Internal Clarifications', description: 'Review clarification requests', href: '/internal-review', icon: <MessageSquare className="w-4 h-4" />, keywords: ['clarify', 'clarification', 'internal', 'review', 'questions'] },
  { id: 'settings', label: 'Settings', description: 'App settings and schedules', href: '/settings', icon: <Settings className="w-4 h-4" />, keywords: ['settings', 'config', 'schedule', 'preferences'] },
  { id: 'admin', label: 'Admin', description: 'User management and admin tools', href: '/admin', icon: <Users className="w-4 h-4" />, keywords: ['admin', 'users', 'management', 'permissions'] },
  { id: 'dashboard', label: 'Dashboard', description: 'Return to main dashboard', href: '/', icon: <Clock className="w-4 h-4" />, keywords: ['home', 'dashboard', 'main'] },
];

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const open = useCallback(() => {
    setIsOpen(true);
    setQuery('');
    setSelectedIndex(0);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
  }, []);

  useKeyboardShortcuts([
    { key: 'k', ctrlKey: true, handler: open, ignoreInputFocus: true },
    { key: '/', handler: open },
    { key: 'Escape', handler: close, ignoreInputFocus: true },
  ]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const filtered = query.trim()
    ? COMMANDS.filter(cmd => {
        const q = query.toLowerCase();
        return cmd.label.toLowerCase().includes(q) ||
          cmd.description.toLowerCase().includes(q) ||
          cmd.keywords.some(k => k.includes(q));
      })
    : COMMANDS;

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const navigate = (href: string) => {
    close();
    router.push(href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault();
      navigate(filtered[selectedIndex].href);
    } else if (e.key === 'Escape') {
      close();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh]">
      <div className="fixed inset-0 bg-black/50" onClick={close} />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden" data-testid="command-palette">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages..."
            className="flex-1 text-sm text-gray-900 placeholder-gray-400 outline-none"
          />
          <kbd className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-500 text-center">No results found</p>
          ) : (
            filtered.map((cmd, index) => (
              <button
                key={cmd.id}
                onClick={() => navigate(cmd.href)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  index === selectedIndex ? 'bg-blue-50 text-blue-900' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  index === selectedIndex ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {cmd.icon}
                </div>
                <div>
                  <p className="text-sm font-medium">{cmd.label}</p>
                  <p className="text-xs text-gray-500">{cmd.description}</p>
                </div>
              </button>
            ))
          )}
        </div>
        <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400">
          <span><kbd className="bg-gray-100 px-1 rounded">↑↓</kbd> navigate</span>
          <span><kbd className="bg-gray-100 px-1 rounded">↵</kbd> open</span>
          <span><kbd className="bg-gray-100 px-1 rounded">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
