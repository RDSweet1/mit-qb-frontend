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

export interface CustomerProfitability {
  id: number;
  week_start: string;
  week_end: string;
  qb_customer_id: string;
  customer_name: string;
  total_hours: number;
  billable_hours: number;
  overhead_hours: number;
  billable_revenue: number;
  labor_cost: number;
  margin: number;
  margin_percent: number;
  entry_count: number;
  unbilled_hours: number;
  breakdown_by_employee: Record<string, { hours: number; cost: number; revenue: number }>;
  breakdown_by_service: Record<string, { hours: number; revenue: number; count: number }>;
}

export interface ScheduleConfig {
  id: number;
  function_name: string;
  display_name: string;
  description: string | null;
  is_paused: boolean;
  schedule_day: string;
  schedule_time: string;
  timezone: string;
  last_run_at: string | null;
  last_run_status: string | null;
  paused_by: string | null;
  paused_at: string | null;
  updated_at: string;
}

export interface InternalAssignment {
  id: number;
  time_entry_id: number;
  assigned_by: string;
  assigned_to_email: string;
  assigned_to_name: string;
  question: string;
  suggested_description: string | null;
  status: string;
  batch_id: string | null;
  created_at: string;
  responded_at: string | null;
  cleared_at: string | null;
  cleared_by?: string | null;
}

export interface InternalMessage {
  id: number;
  assignment_id: number;
  sender_email: string;
  sender_name: string;
  sender_role: 'admin' | 'assignee';
  message: string;
  suggested_description: string | null;
  created_at: string;
}

export interface InternalReviewToken {
  id: number;
  assignment_id: number;
  token: string;
  expires_at: string;
  first_opened_at: string | null;
  last_opened_at: string | null;
  open_count: number;
}

export type DatePreset = 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'all_time' | 'custom';

// --- Cash Position ---

export interface QBPayment {
  id: number;
  qb_payment_id: string;
  txn_date: string;
  qb_customer_id: string | null;
  customer_name: string | null;
  total_amount: number;
  payment_method: string | null;
  payment_ref_num: string | null;
  deposit_to_account: string | null;
  unapplied_amount: number;
  linked_invoices: Array<{ invoiceId: string; amount: number }>;
  sync_token: string | null;
  synced_at: string;
}

export interface QBDeposit {
  id: number;
  qb_deposit_id: string;
  txn_date: string;
  total_amount: number;
  deposit_to_account: string | null;
  line_items: any[];
  memo: string | null;
  synced_at: string;
}

export interface QBInvoiceBalance {
  id: number;
  qb_invoice_id: string;
  invoice_number: string | null;
  qb_customer_id: string | null;
  customer_name: string | null;
  txn_date: string | null;
  due_date: string | null;
  total_amount: number;
  balance: number;
  status: 'Paid' | 'Partial' | 'Open' | 'Overdue';
  synced_at: string;
}

export interface CashPositionWeek {
  weekStart: string;
  billed: number;
  received: number;
  labor: number;
  overhead: number;
  expenses: number;
  net: number;
  ytdBilled: number;
  ytdReceived: number;
  ytdExpenses: number;
  ytdNet: number;
  collectionPct: number;
  expenseRatioPct: number;
}

// --- Cash Position Summary (Net Position) ---

export interface CashPositionAccount {
  id: string;
  name: string;
  accountType: 'Bank' | 'Credit Card';
  currentBalance: number;
  active: boolean;
}

export interface CashPositionBill {
  id: string;
  vendorName: string;
  txnDate: string;
  dueDate: string | null;
  totalAmount: number;
  balance: number;
  isOverdue: boolean;
  daysUntilDue: number | null;
}

export interface CCExpenseBreakdownItem {
  accountName: string;
  category: string;
  totalAmount: number;
  transactionCount: number;
}

export interface CashPositionTotals {
  totalCash: number;
  totalCCDebt: number;
  totalAR: number;
  totalAP: number;
  netPosition: number;
  arCount: number;
  apCount: number;
}

export interface CashPositionSummaryResponse {
  success: boolean;
  accounts: CashPositionAccount[];
  openBills: CashPositionBill[];
  ccExpenseBreakdown: CCExpenseBreakdownItem[];
  totals: CashPositionTotals;
  fetchedAt: string;
  error?: string;
}

// --- Daily Financial Review ---

export interface QBLineItem {
  Id?: string;
  LineNum?: number;
  DetailType: string;
  Amount: number;
  Description?: string | null;
  AccountRef?: { value: string; name: string } | null;
  CustomerRef?: { value: string; name: string } | null;
  ItemRef?: { value: string; name: string } | null;
}

export interface DailyReviewTransaction {
  id: number;
  qb_entity_type: 'Purchase' | 'Bill' | 'BillPayment' | 'Transfer' | 'VendorCredit' | 'Payment' | 'Deposit';
  qb_entity_id: string;
  qb_sync_token: string | null;
  txn_class: 'expense' | 'revenue';
  txn_date: string;
  total_amount: number;
  vendor_name: string | null;
  customer_name: string | null;
  qb_customer_id: string | null;
  memo: string | null;
  payment_type: string | null;
  qb_account_name: string | null;
  qb_account_id: string | null;
  line_items: QBLineItem[];
  review_status: 'pending' | 'reviewed' | 'auto_approved' | 'flagged';
  reviewed_by: string | null;
  reviewed_at: string | null;
  category: string | null;
  category_source: 'auto' | 'vendor' | 'manual' | 'recurring';
  is_overhead: boolean;
  recurring_rule_id: number | null;
  synced_at: string;
  updated_at: string;
}
