'use client';

import { ReactNode } from 'react';
import { useMsal } from '@azure/msal-react';
import { Clock, LogOut } from 'lucide-react';
import Link from 'next/link';
import { ProtectedPage } from '@/components/ProtectedPage';
import { AppNav } from '@/components/AppNav';
import { CommandPalette } from '@/components/CommandPalette';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { instance, accounts } = useMsal();
  const user = accounts[0];

  return (
    <ProtectedPage>
      <div className="min-h-screen bg-gray-50" data-testid="app-shell">
        <header className="bg-white shadow-sm border-b border-gray-200" data-testid="app-header">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <Link href="/" className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">MIT Consulting</h1>
                  <p className="text-xs text-gray-500">Timesheet & Billing</p>
                </div>
              </Link>
              <div className="flex items-center gap-4">
                <div className="text-right hidden md:block">
                  <p className="text-sm font-medium text-gray-900" data-testid="user-name">{user?.name}</p>
                  <p className="text-xs text-gray-500">{user?.username}</p>
                </div>
                <button
                  onClick={() => instance.logoutPopup()}
                  className="px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Sign Out"
                  data-testid="sign-out-button"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </header>
        <AppNav />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <CommandPalette />
      </div>
    </ProtectedPage>
  );
}
