/**
 * Shared constants for public pages (review, clarify).
 * These pages don't use AppShell/Tailwind so they use inline styles.
 */

// ─── Color palette (superset of review + clarify colors) ────────────
export const COLORS = {
  blue: '#2563eb',
  blueDark: '#1e40af',
  green: '#16a34a',
  greenDark: '#166534',
  greenBg: '#f0fdf4',
  amber: '#d97706',
  amberDark: '#92400e',
  amberBg: '#fffbeb',
  amberBorder: '#f59e0b',
  red: '#dc2626',
  gray: '#6b7280',
  grayLight: '#f9fafb',
  grayBorder: '#e5e7eb',
};

// ─── Service item color coding ──────────────────────────────────────
export const SERVICE_COLORS: Record<string, { bg: string; text: string }> = {
  'Expert Analysis': { bg: '#ede9fe', text: '#5b21b6' },
  'Site Inspection': { bg: '#dbeafe', text: '#1e40af' },
  'Travel': { bg: '#fef3c7', text: '#92400e' },
  'Report Writing': { bg: '#fce7f3', text: '#9d174d' },
  'Consultation': { bg: '#d1fae5', text: '#065f46' },
  'Project Management': { bg: '#e0e7ff', text: '#3730a3' },
  'Administrative': { bg: '#f3f4f6', text: '#374151' },
};

// ─── MIT logo (base64, same as in email templates) ──────────────────
export const MIT_LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAhklEQVR42u2WSw6AMAhE5zKezON7iLpyU+OAfCZGJd1BeC2UD5Z1az34AbWAcUglYFiSAhBHTgby0eCWKIk1sWeAQP5dAO6dq85a3L27qZ0MXglIVjIDmOn1FNekjQOuekYZIPKC9hzEarj4mz4ekGG4epGimyrmQftEU8xk0Vah2Is+v5vuGba66UdGBNoAAAAASUVORK5CYII=';

// ─── Date formatters for public pages ───────────────────────────────
export function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function fmtShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.toLocaleDateString('en-US', { weekday: 'short' });
  return `${day} ${d.getMonth() + 1}/${d.getDate()}`;
}
