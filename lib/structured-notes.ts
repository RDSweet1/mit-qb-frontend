/**
 * Structured Notes — frontend formatting helpers.
 * Mirrors supabase/functions/_shared/structured-notes.ts for client-side use.
 */

// ── Core interface ─────────────────────────────────────────────────────
export interface StructuredNotes {
  activityPerformed?: string | null;
  complications?:     string | null;
  whyNecessary?:      string | null;
  resourcesUsed?:     string | null;
  clientBenefit?:     string | null;
}

// ── Labels ─────────────────────────────────────────────────────────────
export const FIELD_LABELS = {
  activityPerformed: 'Activity Performed',
  complications:     'Complications / Difficulty',
  whyNecessary:      'Why Activity Necessary',
  resourcesUsed:     'Resources / Documents Used',
  clientBenefit:     'Client Benefit',
} as const;

export const SHORT_LABELS: Record<keyof StructuredNotes, string> = {
  activityPerformed: 'Activity',
  complications:     'Complications',
  whyNecessary:      'Why Necessary',
  resourcesUsed:     'Resources',
  clientBenefit:     'Client Benefit',
};

/** Fields shown to clients (excludes Complications). */
export const CLIENT_FIELDS: (keyof StructuredNotes)[] = [
  'activityPerformed', 'whyNecessary', 'resourcesUsed', 'clientBenefit',
];

/** All fields in display order. */
export const ALL_FIELDS: (keyof StructuredNotes)[] = [
  'activityPerformed', 'complications', 'whyNecessary', 'resourcesUsed', 'clientBenefit',
];

// ── Detection ──────────────────────────────────────────────────────────

/** Check whether an entry object has structured notes. Works with both
 *  snake_case DB rows and camelCase StructuredNotes objects. */
export function hasStructuredNotes(entry: Record<string, unknown>): boolean {
  return !!(
    entry.activity_performed ||
    entry.complications ||
    entry.why_necessary ||
    entry.resources_used ||
    entry.client_benefit
  );
}

/** Pull structured fields from a DB row (snake_case) into camelCase. */
export function extractStructuredFields(entry: Record<string, unknown>): StructuredNotes | null {
  if (!hasStructuredNotes(entry)) return null;
  return {
    activityPerformed: (entry.activity_performed as string) || null,
    complications:     (entry.complications as string) || null,
    whyNecessary:      (entry.why_necessary as string) || null,
    resourcesUsed:     (entry.resources_used as string) || null,
    clientBenefit:     (entry.client_benefit as string) || null,
  };
}

// ── Junk-note filter ───────────────────────────────────────────────────
const JUNK_NOTES = new Set([
  'clock', 'clocked', 'clocked in', 'clocked out',
  'test', 'n/a', 'na', '.', '-',
]);

export function isJunkNote(note?: string | null): boolean {
  return !note || JUNK_NOTES.has(note.trim().toLowerCase());
}

// ── Formatting ─────────────────────────────────────────────────────────

/** Multi-line plain text with labels. */
export function formatPlainText(sn: StructuredNotes, internal = false): string {
  const fields = internal ? ALL_FIELDS : CLIENT_FIELDS;
  return fields
    .filter(k => sn[k])
    .map(k => `${SHORT_LABELS[k]}: ${sn[k]}`)
    .join('\n');
}

/** Best description string for display. */
export function bestDescription(
  entry: Record<string, unknown>,
  internal = false,
): string {
  const sn = extractStructuredFields(entry);
  if (sn) return formatPlainText(sn, internal);

  const desc = entry.description as string | null;
  if (desc) return desc;

  const notes = entry.notes as string | null;
  if (notes && !isJunkNote(notes)) return notes;

  return '';
}
