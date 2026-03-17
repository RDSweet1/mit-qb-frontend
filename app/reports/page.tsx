'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { REPORT_TYPES } from '@/lib/reportTypes';
import { WeeklyActivityReport } from '@/components/reports/WeeklyActivityReport';
import { CounselBillingReport } from '@/components/reports/CounselBillingReport';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('weekly-activity');

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto">
        <PageHeader
          title="Reports"
          subtitle="Generate, preview, and send reports"
          icon={<FileText className="w-6 h-6 text-green-600" />}
        />

        {/* Report Type Selector */}
        <div className="flex gap-2 mb-6">
          {REPORT_TYPES.map((rt) => {
            const Icon = rt.icon;
            const isActive = activeTab === rt.key;
            return (
              <button
                key={rt.key}
                onClick={() => setActiveTab(rt.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? rt.color === 'green'
                      ? 'bg-green-600 text-white shadow-sm'
                      : 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {rt.label}
              </button>
            );
          })}
        </div>

        {/* Report Content */}
        {activeTab === 'weekly-activity' && <WeeklyActivityReport />}
        {activeTab === 'counsel-billing' && <CounselBillingReport />}
      </div>
    </AppShell>
  );
}
