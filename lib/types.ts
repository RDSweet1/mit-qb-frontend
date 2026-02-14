// Canonical shared TypeScript types for the MIT Consulting app.
// Import from '@/lib/types' instead of defining inline per page.

export interface TimeEntry {
  id: number;
  qb_time_id: string;
  employee_name: string;
  qb_customer_id: string;
  txn_date: string;
  start_time: string | null;
  end_time: string | null;
  hours: number;
  minutes: number;
  service_item_name: string;
  cost_code: string;
  qb_item_id: string | null;
  description: string;
  notes: string | null;
  billable_status: string;
  approval_status: string;
  is_locked: boolean;
  unlocked_by: string | null;
  unlocked_at: string | null;
  manually_edited: boolean;
  edit_count: number;
  updated_at: string | null;
  updated_by: string | null;
  sent_at?: string | null;
  sent_to?: string | null;
  change_reason?: string | null;
  post_send_edit?: boolean;
  amended_at?: string | null;
  has_active_clarification?: boolean;
}

/** Lightweight time entry for unbilled-time and internal-review pages. */
export interface TimeEntrySummary {
  id: number;
  txn_date: string;
  employee_name: string;
  qb_customer_id: string;
  cost_code: string | null;
  description: string | null;
  hours: number;
  minutes: number;
  service_item_name?: string | null;
  qb_item_id?: string | null;
  customer_name?: string;
}

export interface Customer {
  qb_customer_id: string;
  display_name: string;
  email?: string | null;
  is_active?: boolean;
  is_internal?: boolean;
}

export interface ServiceItem {
  qb_item_id: string;
  name: string;
  code?: string | null;
  unit_price?: number;
}

export interface AppUser {
  id: string;
  email: string;
  display_name: string;
  entra_id: string;
  can_view: boolean;
  can_send_reminders: boolean;
  can_create_invoices: boolean;
  is_admin: boolean;
  can_edit_time: boolean;
  can_manage_users: boolean;
  last_login: string | null;
  created_at: string;
}

export interface EmployeeRate {
  id: number;
  employee_name: string;
  qb_employee_id: string | null;
  base_hourly_rate: number;
  burden_multiplier: number;
  fully_loaded_rate: number;
  role: string;
  is_active: boolean;
  notes: string | null;
  updated_at: string;
}

export interface ReportPeriod {
  id: number;
  customer_name: string;
  qb_customer_id: string;
  week_start: string;
  week_end: string;
  status: 'pending' | 'sent' | 'supplemental_sent' | 'accepted' | 'disputed' | 'no_time';
  total_hours: number;
  entry_count: number;
  late_entry_count: number;
  late_entry_hours: number;
  sent_at: string | null;
  accepted_at: string | null;
  report_number: string | null;
}

export type DatePreset = 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'all_time' | 'custom';
