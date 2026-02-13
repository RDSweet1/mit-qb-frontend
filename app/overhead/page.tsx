'use client';

import { useState, useEffect } from 'react';
import { Wrench } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { supabase } from '@/lib/supabaseClient';
import OverheadSyncPanel from '@/components/overhead/OverheadSyncPanel';
import VendorTransactionTable from '@/components/overhead/VendorTransactionTable';
import CategoryManager from '@/components/overhead/CategoryManager';

type ActiveTab = 'vendors' | 'categories';

export default function OverheadPage() {
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
    <AppShell>
          <PageHeader
            title="Overhead Management"
            subtitle="Manage vendor-based overhead categorization from QuickBooks expense transactions"
            icon={<Wrench className="w-6 h-6 text-teal-600" />}
          />

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
    </AppShell>
  );
}
