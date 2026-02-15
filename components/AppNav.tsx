'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock, FileText, DollarSign, TrendingUp, Settings, Users, BarChart3, MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

const navItems = [
  { href: '/time-entries-enhanced', label: 'Time Entries', icon: Clock, color: 'blue' },
  { href: '/reports', label: 'Reports', icon: FileText, color: 'green' },
  { href: '/invoices', label: 'Invoices', icon: DollarSign, color: 'purple' },
  { href: '/profitability', label: 'Profitability', icon: TrendingUp, color: 'purple' },
  { href: '/analytics/unbilled-time', label: 'Unbilled', icon: BarChart3, color: 'orange' },
  { href: '/internal-review', label: 'Clarifications', icon: MessageSquare, color: 'amber' },
  { href: '/settings', label: 'Settings', icon: Settings, color: 'gray' },
  { href: '/admin', label: 'Admin', icon: Users, color: 'gray' },
];

export function AppNav() {
  const pathname = usePathname();
  const [pausedCount, setPausedCount] = useState(0);
  const [qbConnected, setQbConnected] = useState<boolean | null>(null);
  const [unbilledCount, setUnbilledCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  // Normalize path — strip basePath prefix if present
  const normalizedPath = pathname?.replace(/^\/mit-qb-frontend/, '') || '/';

  useEffect(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const since30 = thirtyDaysAgo.toISOString().split('T')[0];

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const since14 = fourteenDaysAgo.toISOString().split('T')[0];

    Promise.all([
      // Paused schedules (existing)
      supabase
        .from('schedule_config')
        .select('id', { count: 'exact', head: true })
        .eq('is_paused', true),
      // QB connection status
      supabase
        .from('qb_tokens')
        .select('expires_at')
        .single(),
      // Unbilled entries (last 30 days, no cost code)
      supabase
        .from('time_entries')
        .select('id', { count: 'exact', head: true })
        .is('qb_item_id', null)
        .is('service_item_name', null)
        .gte('txn_date', since30),
      // Pending approval (last 14 days)
      supabase
        .from('time_entries')
        .select('id', { count: 'exact', head: true })
        .eq('approval_status', 'pending')
        .gte('txn_date', since14),
    ]).then(([pausedRes, qbRes, unbilledRes, pendingRes]) => {
      setPausedCount(pausedRes.count || 0);
      setQbConnected(
        qbRes.data && !qbRes.error
          ? new Date(qbRes.data.expires_at) > new Date()
          : false
      );
      setUnbilledCount(unbilledRes.count || 0);
      setPendingCount(pendingRes.count || 0);
    });
  }, []);

  // Determine badge for each tab
  function getBadge(href: string): { count: number; color: string } | null {
    if (href === '/admin' && pausedCount > 0) return { count: pausedCount, color: 'bg-red-500' };
    if (href === '/analytics/unbilled-time' && unbilledCount > 0) return { count: unbilledCount, color: 'bg-red-500' };
    if (href === '/time-entries-enhanced' && pendingCount > 0) return { count: pendingCount, color: 'bg-blue-500' };
    return null;
  }

  return (
    <nav className="bg-white border-b border-gray-200" data-testid="app-nav">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-1 py-1 -mb-px">
          <div className="flex gap-1 overflow-x-auto">
            {navItems.map(item => {
              const isActive = normalizedPath === item.href ||
                (item.href !== '/' && normalizedPath.startsWith(item.href));

              const badge = getBadge(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-testid={`nav-tab-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={item.label}
                  className={`relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors border-b-2 ${
                    isActive
                      ? 'border-blue-600 text-blue-700 bg-blue-50'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <item.icon className="w-4 h-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{item.label}</span>
                  {badge && (
                    <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center ${badge.color} text-white text-[10px] font-bold rounded-full px-1`}>
                      {badge.count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* QB Status indicator — right-aligned */}
          {qbConnected !== null && (
            <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium whitespace-nowrap">
              <span className={`w-2 h-2 rounded-full ${qbConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className={`hidden sm:inline ${qbConnected ? 'text-green-700' : 'text-red-700'}`}>
                {qbConnected ? 'QB Connected' : 'QB Disconnected'}
              </span>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
