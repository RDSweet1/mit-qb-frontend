/**
 * Epic C — customer recipients + billing hierarchy API tests
 *
 * Covers:
 *  - sync-customer-billing-hierarchy dryRun
 *  - customer_recipients RLS (anon CRUD visible)
 *  - customers has the new Epic C columns
 */

import { test, expect } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const fnHeaders = {
  Authorization: `Bearer ${ANON_KEY}`,
  apikey: ANON_KEY,
  'Content-Type': 'application/json',
};

test.describe('sync-customer-billing-hierarchy', () => {
  test('OPTIONS returns 200 (CORS preflight)', async ({ request }) => {
    const res = await request.fetch(`${SUPABASE_URL}/functions/v1/sync-customer-billing-hierarchy`, {
      method: 'OPTIONS',
      headers: fnHeaders,
    });
    expect(res.status()).toBe(200);
  });

  test('dryRun returns success with expected shape', async ({ request }) => {
    const res = await request.post(`${SUPABASE_URL}/functions/v1/sync-customer-billing-hierarchy`, {
      headers: fnHeaders,
      data: { dryRun: true },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.dryRun).toBe(true);
    expect(typeof body.synced).toBe('number');
  });
});

test.describe('customers table — Epic C columns', () => {
  test('new columns exist (qb_parent_customer_id, bill_to_cache, mit_adds_markup, email_framing_template)', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/customers?select=id,qb_parent_customer_id,bill_to_cache,mit_adds_markup,email_framing_template&limit=1`,
      { headers: fnHeaders }
    );
    expect(res.ok()).toBeTruthy();
    const rows = await res.json();
    expect(Array.isArray(rows)).toBeTruthy();
    // If there's at least one customer, verify column presence
    if (rows.length > 0) {
      const row = rows[0];
      expect(row).toHaveProperty('qb_parent_customer_id');
      expect(row).toHaveProperty('bill_to_cache');
      expect(row).toHaveProperty('mit_adds_markup');
      expect(row).toHaveProperty('email_framing_template');
      expect(typeof row.mit_adds_markup).toBe('boolean');
    }
  });

  test('backfill populated at least one parent linkage', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/customers?qb_parent_customer_id=not.is.null&select=id,display_name,qb_parent_customer_id,bill_to_cache&limit=5`,
      { headers: fnHeaders }
    );
    expect(res.ok()).toBeTruthy();
    const rows = await res.json();
    // After backfill there should be at least 1 sub-customer with parent metadata.
    // If this fails, re-invoke sync-customer-billing-hierarchy.
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].bill_to_cache).toBeTruthy();
    expect(rows[0].bill_to_cache.name).toBeTruthy();
  });
});

test.describe('customer_recipients — RLS smoke test', () => {
  test('anon can SELECT (table exists, RLS allows read)', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/customer_recipients?select=*&limit=5`,
      { headers: fnHeaders }
    );
    expect(res.ok()).toBeTruthy();
    const rows = await res.json();
    expect(Array.isArray(rows)).toBeTruthy();
  });

  test('anon can INSERT/DELETE via recipients UI path', async ({ request }) => {
    // Find any customer to attach the test row to
    const cRes = await request.get(
      `${SUPABASE_URL}/rest/v1/customers?select=id&limit=1`,
      { headers: fnHeaders }
    );
    const [c] = await cRes.json();
    if (!c) test.skip(true, 'no customers to test against');

    const testEmail = `test-ephemeral-${Date.now()}@example.com`;
    const insRes = await request.post(`${SUPABASE_URL}/rest/v1/customer_recipients`, {
      headers: { ...fnHeaders, Prefer: 'return=representation' },
      data: {
        customer_id: c.id,
        email: testEmail,
        role: 'cc',
        applies_to: ['invoice'],
      },
    });
    expect(insRes.ok()).toBeTruthy();
    const [inserted] = await insRes.json();
    expect(inserted.id).toBeTruthy();

    // Clean up
    const delRes = await request.delete(
      `${SUPABASE_URL}/rest/v1/customer_recipients?id=eq.${inserted.id}`,
      { headers: fnHeaders }
    );
    expect(delRes.ok()).toBeTruthy();
  });
});
