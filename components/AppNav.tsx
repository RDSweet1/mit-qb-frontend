'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock, FileText, DollarSign, TrendingUp, Settings, Users, BarChart3, MessageSquare, Wrench } from 'lucide-react';

const navItems = [
  { href: '/time-entries-enhanced', label: 'Time Entries', icon: Clock, color: 'blue' },
  { href: '/reports', label: 'Reports', icon: FileText, color: 'green' },
  { href: '/invoices', label: 'Invoices', icon: DollarSign, color: 'purple' },
  { href: '/profitability', label: 'Profitability', icon: TrendingUp, color: 'purple' },
  { href: '/overhead', label: 'Overhead', icon: Wrench, color: 'teal' },
  { href: '/analytics/unbilled-time', label: 'Unbilled', icon: BarChart3, color: 'orange' },
  { href: '/internal-review', label: 'Clarifications', icon: MessageSquare, color: 'amber' },
  { href: '/settings', label: 'Settings', icon: Settings, color: 'gray' },
  { href: '/admin', label: 'Admin', icon: Users, color: 'gray' },
];

export function AppNav() {
  const pathname = usePathname();

  // Normalize path — strip basePath prefix if present
  const normalizedPath = pathname?.replace(/^\/mit-qb-frontend/, '') || '/';

  return (
    <nav className="bg-white border-b border-gray-200" data-testid="app-nav">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-1 overflow-x-auto py-1 -mb-px">
          {navItems.map(item => {
            const isActive = normalizedPath === item.href ||
              (item.href !== '/' && normalizedPath.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={`nav-tab-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors border-b-2 ${
                  isActive
                    ? 'border-blue-600 text-blue-700 bg-blue-50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
