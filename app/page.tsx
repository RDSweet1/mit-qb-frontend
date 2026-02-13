'use client';

import { useMsal } from '@azure/msal-react';
import { loginRequest } from '@/lib/authConfig';
import { useEffect, useState } from 'react';
import { LogIn, Clock, FileText, DollarSign, Settings, Users, Download, MonitorSmartphone, X, MessageSquare, BarChart3, TrendingUp, Wrench } from 'lucide-react';
import Link from 'next/link';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { AnalyticsCharts } from '@/components/dashboard/AnalyticsCharts';
import { ProfitabilitySummary } from '@/components/dashboard/ProfitabilitySummary';
import { AppShell } from '@/components/AppShell';
import { supabase } from '@/lib/supabaseClient';

export default function Home() {
  const { instance, accounts, inProgress } = useMsal();
  const [loading, setLoading] = useState(false);
  const [isMsalReady, setIsMsalReady] = useState(false);

  const isAuthenticated = accounts.length > 0;
  const user = accounts[0];
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [clarificationCount, setClarificationCount] = useState(0);
  const [unbilledCount, setUnbilledCount] = useState(0);

  // Check if MSAL is ready before using it
  useEffect(() => {
    if (instance && inProgress === 'none') {
      setIsMsalReady(true);
    }
  }, [instance, inProgress]);

  // DEBUG: Log on mount and when accounts change
  useEffect(() => {
    console.log('🔍 DEBUG v2: Home component mounted/updated');
    console.log('🔍 DEBUG v2: Is authenticated:', isAuthenticated);
    console.log('🔍 DEBUG v2: Accounts:', accounts);
    console.log('🔍 DEBUG v2: User:', user);
    console.log('🔍 DEBUG v2: Build timestamp:', new Date().toISOString());
  }, [isAuthenticated, accounts, user]);

  // Load clarification badge count
  useEffect(() => {
    if (!isAuthenticated) return;
    supabase
      .from('internal_assignments')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'responded'])
      .then(({ count }) => { setClarificationCount(count || 0); });
  }, [isAuthenticated]);

  // Load unbilled entries count (entries with no qb_item_id)
  useEffect(() => {
    if (!isAuthenticated) return;
    supabase
      .from('time_entries')
      .select('id', { count: 'exact', head: true })
      .is('qb_item_id', null)
      .then(({ count }) => { setUnbilledCount(count || 0); });
  }, [isAuthenticated]);

  // Register service worker + capture PWA install prompt
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const base = window.location.pathname.includes('/mit-qb-frontend') ? '/mit-qb-frontend' : '';
      navigator.serviceWorker.register(`${base}/sw.js`).catch(() => {});
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setShowInstallBanner(false);
      setInstallPrompt(null);
    }
  };

  // Pick up login_hint from URL for pre-filled sign-in
  const getLoginHint = (): string | undefined => {
    if (typeof window === 'undefined') return undefined;
    const params = new URLSearchParams(window.location.search);
    return params.get('login_hint') || undefined;
  };

  const downloadDesktopShortcut = () => {
    const hint = getLoginHint() || user?.username || '';
    const base = window.location.origin + (window.location.pathname.includes('/mit-qb-frontend') ? '/mit-qb-frontend/' : '/');
    const url = hint ? `${base}?login_hint=${encodeURIComponent(hint)}` : base;
    const content = `[InternetShortcut]\r\nURL=${url}\r\nIconIndex=0\r\n`;
    const blob = new Blob([content], { type: 'application/internet-shortcut' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'MIT Timesheet.url';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleLogin = async () => {
    console.log('🔍 DEBUG: handleLogin called - button clicked!');

    setLoading(true);
    try {
      const loginHint = getLoginHint();
      const request = loginHint ? { ...loginRequest, loginHint } : loginRequest;
      console.log('🔍 DEBUG: Calling loginPopup...', loginHint ? `(hint: ${loginHint})` : '');
      const result = await instance.loginPopup(request);
      console.log('✅ DEBUG: Login successful!', result);
    } catch (error: any) {
      console.error('❌ DEBUG: Login failed with error:', error);
      console.error('❌ DEBUG: Error name:', error?.name);
      console.error('❌ DEBUG: Error message:', error?.message);
      console.error('❌ DEBUG: Error code:', error?.errorCode);
      console.error('❌ DEBUG: Error description:', error?.errorMessage);
      console.error('❌ DEBUG: Full error object:', JSON.stringify(error, null, 2));

      // Show alert to user
      alert(`Login Error:\n${error?.message || error}\n\nCheck console (F12) for details.`);
    } finally {
      console.log('🔍 DEBUG: Login attempt finished, setting loading to false');
      setLoading(false);
    }
  };

  // Show loading screen while MSAL initializes
  if (!isMsalReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl mx-auto mb-4 flex items-center justify-center">
              <Clock className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              MIT Consulting
            </h1>
            <p className="text-gray-600">QuickBooks Timesheet System</p>
          </div>

          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Internal Use Only:</strong> This application is exclusively for MIT Consulting employees.
            </p>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="spinner w-5 h-5 border-2"></div>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Sign in with Microsoft
              </>
            )}
          </button>

          <button
            onClick={downloadDesktopShortcut}
            className="w-full mt-3 flex items-center justify-center gap-2 px-6 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Save Desktop Shortcut
          </button>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              By signing in, you agree to the{' '}
              <a href="/eula" className="text-blue-600 hover:underline">
                EULA & Privacy Policy
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      {/* Install App Banner */}
      {showInstallBanner && (
        <div className="bg-blue-600 text-white rounded-lg mb-6 py-3 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MonitorSmartphone className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">Install MIT Timesheet as a desktop app for quick access and taskbar pinning.</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleInstall}
              className="px-4 py-1.5 bg-white text-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-50 transition-colors"
            >
              Install App
            </button>
            <button onClick={() => setShowInstallBanner(false)} className="p-1 hover:bg-blue-500 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h2>
          <p className="text-gray-600">Manage timesheets, reports, and invoices</p>
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/time-entries-enhanced" className="group">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all duration-200">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Time Entries</h3>
              <p className="text-sm text-gray-600">
                View time entries with filters and generate weekly reports
              </p>
            </div>
          </Link>

          <Link href="/reports" className="group">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-green-300 transition-all duration-200">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-green-200 transition-colors">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Weekly Reports</h3>
              <p className="text-sm text-gray-600">
                Generate and send weekly time reports to clients
              </p>
            </div>
          </Link>

          <Link href="/invoices" className="group">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-purple-300 transition-all duration-200">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-purple-200 transition-colors">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Invoices</h3>
              <p className="text-sm text-gray-600">
                Create monthly invoices in QuickBooks Online
              </p>
            </div>
          </Link>

          <Link href="/settings" className="group">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all duration-200">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-gray-200 transition-colors">
                <Settings className="w-6 h-6 text-gray-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Settings</h3>
              <p className="text-sm text-gray-600">
                Configure QuickBooks connection and automation
              </p>
            </div>
          </Link>

          <Link href="/admin/users" className="group">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-indigo-300 transition-all duration-200">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-indigo-200 transition-colors">
                <Users className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">User Management</h3>
              <p className="text-sm text-gray-600">
                Manage users, roles, and permissions
              </p>
            </div>
          </Link>

          <Link href="/internal-review" className="group">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-amber-300 transition-all duration-200 relative">
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-amber-200 transition-colors">
                <MessageSquare className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Internal Clarifications</h3>
              <p className="text-sm text-gray-600">
                Request and track time entry clarifications
              </p>
              {clarificationCount > 0 && (
                <span className="absolute top-4 right-4 bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {clarificationCount}
                </span>
              )}
            </div>
          </Link>

          <Link href="/analytics/unbilled-time" className="group">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-orange-300 transition-all duration-200 relative">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-orange-200 transition-colors">
                <BarChart3 className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Unbilled Time</h3>
              <p className="text-sm text-gray-600">
                Find time entries missing cost codes
              </p>
              {unbilledCount > 0 && (
                <span className="absolute top-4 right-4 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {unbilledCount}
                </span>
              )}
            </div>
          </Link>

          <Link href="/profitability" className="group">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-purple-300 transition-all duration-200">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-purple-200 transition-colors">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Profitability</h3>
              <p className="text-sm text-gray-600">
                Weekly P&L trends and overhead analysis
              </p>
            </div>
          </Link>

          <Link href="/overhead" className="group">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-teal-300 transition-all duration-200">
              <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-teal-200 transition-colors">
                <Wrench className="w-6 h-6 text-teal-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Overhead</h3>
              <p className="text-sm text-gray-600">
                Manage vendor-based overhead categorization
              </p>
            </div>
          </Link>

          <Link href="/admin/employee-rates" className="group">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-emerald-300 transition-all duration-200">
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-emerald-200 transition-colors">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Employee Rates</h3>
              <p className="text-sm text-gray-600">
                Manage labor cost rates and profitability
              </p>
            </div>
          </Link>
        </div>

        {/* Quick Stats */}
        <div className="mt-8">
          <DashboardStats />
        </div>

        {/* Profitability Summary */}
        <div className="mt-6">
          <ProfitabilitySummary />
        </div>

        {/* Analytics Charts */}
        <AnalyticsCharts />
    </AppShell>
  );
}
