import { FileText, Scale } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface ReportTypeDefinition {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string; // tailwind color name
}

export const REPORT_TYPES: ReportTypeDefinition[] = [
  {
    key: 'weekly-activity',
    label: 'Weekly Activity',
    description: 'Send weekly time reports to clients',
    icon: FileText,
    color: 'green',
  },
  {
    key: 'counsel-billing',
    label: 'Counsel Billing Summary',
    description: 'Comprehensive billing summary for opposing counsel',
    icon: Scale,
    color: 'blue',
  },
];
