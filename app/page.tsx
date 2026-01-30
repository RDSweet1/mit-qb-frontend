'use client';

import { useMsal } from '@azure/msal-react';
import { loginRequest } from '@/lib/authConfig';
import { useEffect, useState } from 'react';
import { LogIn, Clock, FileText, DollarSign, Settings } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const { instance, accounts } = useMsal();
  const [loading, setLoading] = useState(false);

  const isAuthenticated = accounts.length > 0;
  const user = accounts[0];

  // DEBUG: Log on mount and when accounts change
  useEffect(() => {
    console.log('🔍 DEBUG: Home component mounted/updated');
    console.log('🔍 DEBUG: Is authenticated:', isAuthenticated);
    console.log('🔍 DEBUG: Accounts:', accounts);
    console.log('🔍 DEBUG: User:', user);
  }, [isAuthenticated, accounts, user]);

  const handleLogin = async () => {
    console.log('🔍 DEBUG: handleLogin called - button clicked!');
    console.log('🔍 DEBUG: MSAL instance:', instance);
    console.log('🔍 DEBUG: Current accounts:', accounts);
    console.log('🔍 DEBUG: Login request:', loginRequest);

    setLoading(true);
    try {
      console.log('🔍 DEBUG: Calling loginPopup...');
      const result = await instance.loginPopup(loginRequest);
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

  const handleLogout = () => {
    instance.logoutPopup();
  };

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">MIT Consulting</h1>
                <p className="text-xs text-gray-500">Timesheet & Billing</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.username}</p>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
        </div>

        {/* Quick Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">QuickBooks Status</p>
            <p className="text-2xl font-bold text-green-600">Connected</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">Last Sync</p>
            <p className="text-2xl font-bold text-gray-900">--</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">Pending Reports</p>
            <p className="text-2xl font-bold text-gray-900">--</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">This Month</p>
            <p className="text-2xl font-bold text-gray-900">-- hrs</p>
          </div>
        </div>
      </main>
    </div>
  );
}
