import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, subQuarters, startOfYear, endOfYear, subYears } from 'date-fns';

export interface DatePresetOption {
  key: string;
  label: string;
}

export const STANDARD_PRESETS: DatePresetOption[] = [
  { key: 'this_week', label: 'This Week' },
  { key: 'last_week', label: 'Last Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'all_time', label: 'Show All Data' },
];

export const EXTENDED_PRESETS: DatePresetOption[] = [
  ...STANDARD_PRESETS.filter(p => p.key !== 'all_time'),
  { key: 'this_quarter', label: 'This Quarter' },
  { key: 'last_quarter', label: 'Last Quarter' },
  { key: 'ytd', label: 'Year to Date' },
  { key: 'last_year', label: 'Last Year' },
  { key: 'all_time', label: 'Show All Data' },
];

export function computeDateRange(preset: string): { startDate: string; endDate: string } {
  const now = new Date();

  switch (preset) {
    case 'this_week':
      return {
        startDate: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        endDate: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      };
    case 'last_week': {
      const lastWeekStart = startOfWeek(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), { weekStartsOn: 1 });
      return {
        startDate: format(lastWeekStart, 'yyyy-MM-dd'),
        endDate: format(endOfWeek(lastWeekStart, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      };
    }
    case 'this_month':
      return {
        startDate: format(startOfMonth(now), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(now), 'yyyy-MM-dd'),
      };
    case 'last_month': {
      const lastMonth = subMonths(now, 1);
      return {
        startDate: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(lastMonth), 'yyyy-MM-dd'),
      };
    }
    case 'this_quarter':
      return {
        startDate: format(startOfQuarter(now), 'yyyy-MM-dd'),
        endDate: format(endOfQuarter(now), 'yyyy-MM-dd'),
      };
    case 'last_quarter': {
      const lq = subQuarters(now, 1);
      return {
        startDate: format(startOfQuarter(lq), 'yyyy-MM-dd'),
        endDate: format(endOfQuarter(lq), 'yyyy-MM-dd'),
      };
    }
    case 'ytd':
      return {
        startDate: format(startOfYear(now), 'yyyy-MM-dd'),
        endDate: format(now, 'yyyy-MM-dd'),
      };
    case 'last_year': {
      const ly = subYears(now, 1);
      return {
        startDate: format(startOfYear(ly), 'yyyy-MM-dd'),
        endDate: format(endOfYear(ly), 'yyyy-MM-dd'),
      };
    }
    case 'all_time':
      return {
        startDate: '2020-01-01',
        endDate: format(now, 'yyyy-MM-dd'),
      };
    default:
      return {
        startDate: format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd'),
      };
  }
}
