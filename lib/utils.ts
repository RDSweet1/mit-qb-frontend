import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// --- Currency & Percentage ---

export function fmtMoney(n: number, decimals: number = 0): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Accounting format: negative values shown in parentheses, 2 decimal places */
export function fmtMoneyAccounting(n: number): string {
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `(${formatted})` : formatted;
}

export function fmtPct(n: number): string {
  return n.toFixed(1) + '%';
}

// --- Date Helpers ---

export function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

export function fmtIsoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export function weekLabel(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00');
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  const f = (dt: Date) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${f(d)}\u2013${end.getDate()}`;
}

export function fmtDateTime(isoStr: string): string {
  return new Date(isoStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

// --- Margin Styling ---

export function marginColor(pct: number): string {
  if (pct < 20) return 'text-red-700';
  if (pct < 40) return 'text-amber-700';
  return 'text-green-700';
}

export function marginBg(pct: number): string {
  if (pct < 20) return 'bg-red-50';
  if (pct < 40) return 'bg-amber-50';
  return 'bg-green-50';
}

// --- Legacy helpers (used by other components) ---

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount)
}

export function formatHours(hours: number, minutes: number = 0): string {
  const total = hours + (minutes / 60)
  return `${total.toFixed(2)} hrs`
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(d)
}

export function formatTime(time: string): string {
  if (!time) return ''
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${displayHour}:${minutes} ${ampm}`
}
