/**
 * Epic C + Epic R integration — send-revised-invoice edge function
 *
 * Smoke-tests the notifier that fires when an Epic R receipt amendment
 * lands on an already-sent invoice. dryRun is the safe path for CI so
 * we don't actually email customers.
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

test.describe('send-revised-invoice', () => {
  test('OPTIONS returns 200 (CORS preflight)', async ({ request }) => {
    const res = await request.fetch(`${SUPABASE_URL}/functions/v1/send-revised-invoice`, {
      method: 'OPTIONS',
      headers: fnHeaders,
    });
    expect(res.status()).toBe(200);
  });

  test('rejects missing required fields', async ({ request }) => {
    const res = await request.post(`${SUPABASE_URL}/functions/v1/send-revised-invoice`, {
      headers: fnHeaders,
      data: {},
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('originalSentDate');
  });

  test('rejects unknown customer', async ({ request }) => {
    const res = await request.post(`${SUPABASE_URL}/functions/v1/send-revised-invoice`, {
      headers: fnHeaders,
      data: {
        qbCustomerId: '__not_a_real_qb_id_999999__',
        originalSentDate: 'April 19, 2026',
        amendmentReason: 'test',
        previousTotal: 100,
        revisedTotal: 130,
        changes: ['test'],
        dryRun: true,
      },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('Customer not found');
  });

  test('dryRun succeeds for a real customer', async ({ request }) => {
    // Find any real customer
    const cRes = await request.get(
      `${SUPABASE_URL}/rest/v1/customers?select=qb_customer_id,display_name&limit=1`,
      { headers: fnHeaders }
    );
    const [c] = await cRes.json();
    if (!c?.qb_customer_id) test.skip(true, 'no customers to test against');

    const res = await request.post(`${SUPABASE_URL}/functions/v1/send-revised-invoice`, {
      headers: fnHeaders,
      data: {
        qbCustomerId: c.qb_customer_id,
        originalSentDate: 'April 19, 2026',
        amendmentReason: 'Markup changed from 0% to 30%',
        previousTotal: 1806.03,
        revisedTotal: 2347.84,
        changes: ['Applied 30% markup to billable lodging + parking'],
        dryRun: true,
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.dryRun).toBe(true);
    expect(body.customer).toBe(c.display_name);
    expect(body.revisedTotal).toBe(2347.84);
  });
});
