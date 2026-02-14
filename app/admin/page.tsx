'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Shield, Users, DollarSign, Mail, Clock } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { UsersContent } from './users/UsersContent';
import { EmployeeRatesContent } from './employee-rates/EmployeeRatesContent';
import { ReportRecipientsContent } from './report-recipients/ReportRecipientsContent';
import { SchedulingContent } from './scheduling/SchedulingContent';

const tabs = [
  { id: 'users', label: 'Users', icon: Users },
  { id: 'rates', label: 'Employee Rates', icon: DollarSign },
  { id: 'recipients', label: 'Report Recipients', icon: Mail },
  { id: 'scheduling', label: 'Scheduling', icon: Clock },
] as const;

type TabId = typeof tabs[number]['id'];

export default function AdminPage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as TabId | null;
  const [activeTab, setActiveTab] = useState<TabId>(tabParam && tabs.some(t => t.id === tabParam) ? tabParam : 'users');

  useEffect(() => {
    if (tabParam && tabs.some(t => t.id === tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  return (
    <AppShell>
      <PageHeader
        title="Administration"
        subtitle="Manage users, cost rates, report recipients, and scheduling"
        icon={<Shield className="w-6 h-6 text-indigo-600" />}
      />

      {/* Tab Bar */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-1 -mb-px">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                data-testid={`admin-tab-${tab.id}`}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-indigo-600 text-indigo-700 bg-indigo-50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'users' && <UsersContent />}
      {activeTab === 'rates' && <EmployeeRatesContent />}
      {activeTab === 'recipients' && <ReportRecipientsContent />}
      {activeTab === 'scheduling' && <SchedulingContent />}
    </AppShell>
  );
}
