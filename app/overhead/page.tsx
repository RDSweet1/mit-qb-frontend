'use client';

import { useState, useEffect } from 'react';
import { Wrench, Clock, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useMsal } from '@azure/msal-react';
import { ProtectedPage } from '@/components/ProtectedPage';
import { AppNav } from '@/components/AppNav';
import { supabase } from '@/lib/supabaseClient';
import OverheadSyncPanel from '@/components/overhead/OverheadSyncPanel';
import VendorTransactionTable from '@/components/overhead/VendorTransactionTable';
import CategoryManager from '@/components/overhead/CategoryManager';

type ActiveTab = 'vendors' | 'categories';

export default function OverheadPage() {
  const { instance, accounts } = useMsal();
  const user = accounts[0];
  const [activeTab, setActiveTab] = useState<ActiveTab>('vendors');
  const [categories, setCategories] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Default date range: trailing 12 months
  const now = new Date();
  const defaultStart = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const [startDate, setStartDate] = useState(defaultStart.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(now.toISOString().split('T')[0]);

  // Load categories for dropdowns
  useEffect(() => {
    supabase
      .from('overhead_categories')
      .select('name')
      .order('display_order', { ascending: true })
      .order('name', { ascending: true })
      .then(({ data }) => {
        setCategories((data || []).map(c => c.name));
      });
  }, []);

  return (
    <ProtectedPage>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center gap-3">
                <Link href="/" className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-white" />
                </Link>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">MIT Consulting</h1>
                  <p className="text-xs text-gray-500">Timesheet & Billing</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right hidden md:block">
                  <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                  <p className="text-xs text-gray-500">{user?.username}</p>
                </div>
                <button
                  onClick={() => instance.logoutPopup()}
                  className="px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </header>
        <AppNav />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Wrench className="w-6 h-6 text-teal-600" />
              Overhead Management
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage vendor-based overhead categorization from QuickBooks expense transactions
            </p>
          </div>

          {/* Sync Panel */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
            <OverheadSyncPanel
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onSyncComplete={() => setRefreshKey(k => k + 1)}
            />
          </div>

          {/* Tab Bar */}
          <div className="flex gap-1 mb-6">
            {([
              { key: 'vendors' as ActiveTab, label: 'By Vendor' },
              { key: 'categories' as ActiveTab, label: 'Categories' },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab.key
                    ? 'bg-teal-100 text-teal-800'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'vendors' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <VendorTransactionTable categories={categories} refreshKey={refreshKey} />
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <CategoryManager />
            </div>
          )}
        </main>
      </div>
    </ProtectedPage>
  );
}
