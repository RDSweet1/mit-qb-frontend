'use client';

import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, icon, actions }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6" data-testid="page-header">
      <div className="flex items-center gap-2">
        {icon}
        <div>
          <h2 className="text-2xl font-bold text-gray-900" data-testid="page-title">{title}</h2>
          {subtitle && <p className="text-sm text-gray-600 mt-1" data-testid="page-subtitle">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-3" data-testid="page-actions">{actions}</div>}
    </div>
  );
}
