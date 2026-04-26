import { test, expect } from '@playwright/test';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const fnHeaders = {
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};
const restHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

test.describe('detect-invoice-bounces edge function', () => {
  test('dryRun mode returns success without touching Graph', async ({ request }) => {
    const res = await request.post(`${SUPABASE_URL}/functions/v1/detect-invoice-bounces`, {
      headers: fnHeaders,
      data: { dryRun: true },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.dryRun).toBe(true);
    expect(body.inserted).toBe(0);
  });

  test('manual:true bypasses schedule gate', async ({ request }) => {
    // Run a no-op (lookback 0d) to verify gate bypass works
    const res = await request.post(`${SUPABASE_URL}/functions/v1/detect-invoice-bounces`, {
      headers: fnHeaders,
      data: { manual: true, lookbackDays: 0 },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    // skipped:true means the gate fired and short-circuited. With
    // manual:true it should always proceed to actual execution and
    // return the inserted/skipped/lookbackDays metrics.
    expect(body.skipped).not.toBe(true);
    expect(body.lookbackDays).toBeDefined();
  });

  test('idempotent on source_message_id — calling twice with same lookback inserts once', async ({ request }) => {
    // Two consecutive runs with the same window. Second run's "inserted"
    // count should be 0 (or match new mail arrived between runs, which
    // for a 0-day lookback means 0).
    const window = { manual: true, lookbackDays: 0.01 };  // ~15 min
    const r1 = await request.post(`${SUPABASE_URL}/functions/v1/detect-invoice-bounces`, {
      headers: fnHeaders,
      data: window,
    });
    expect(r1.ok()).toBeTruthy();
    const b1 = await r1.json();
    expect(b1.success).toBe(true);

    const r2 = await request.post(`${SUPABASE_URL}/functions/v1/detect-invoice-bounces`, {
      headers: fnHeaders,
      data: window,
    });
    expect(r2.ok()).toBeTruthy();
    const b2 = await r2.json();
    expect(b2.success).toBe(true);
    // Second run sees identical message_ids → upsert with ignoreDuplicates → inserted=0
    expect(b2.inserted).toBe(0);
  });
});

test.describe('resend-bounced-email validation', () => {
  test('refuses missing bounce_alert_id', async ({ request }) => {
    const res = await request.post(`${SUPABASE_URL}/functions/v1/resend-bounced-email`, {
      headers: fnHeaders,
      data: { to: 'someone@example.com' },
    });
    expect(res.status()).toBe(400);
    const b = await res.json();
    expect(b.success).toBe(false);
    expect(b.error).toContain('bounce_alert_id');
  });

  test('refuses missing to', async ({ request }) => {
    const res = await request.post(`${SUPABASE_URL}/functions/v1/resend-bounced-email`, {
      headers: fnHeaders,
      data: { bounce_alert_id: '00000000-0000-0000-0000-000000000000' },
    });
    expect(res.status()).toBe(400);
    const b = await res.json();
    expect(b.success).toBe(false);
    expect(b.error).toContain('to');
  });

  test('refuses invalid email address', async ({ request }) => {
    const res = await request.post(`${SUPABASE_URL}/functions/v1/resend-bounced-email`, {
      headers: fnHeaders,
      data: { bounce_alert_id: '00000000-0000-0000-0000-000000000000', to: 'not-an-email' },
    });
    expect(res.status()).toBe(400);
    const b = await res.json();
    expect(b.success).toBe(false);
    expect(b.error).toContain('valid email');
  });

  test('refuses non-existent bounce_alert_id', async ({ request }) => {
    const res = await request.post(`${SUPABASE_URL}/functions/v1/resend-bounced-email`, {
      headers: fnHeaders,
      data: {
        bounce_alert_id: '00000000-0000-0000-0000-000000000000',
        to: 'real@example.com',
      },
    });
    expect(res.status()).toBe(404);
    const b = await res.json();
    expect(b.success).toBe(false);
    expect(b.error).toContain('not found');
  });

  test('refuses on already-resolved bounce', async ({ request }) => {
    // Find any resolved row to test against. If none exist, skip.
    const find = await request.get(
      `${SUPABASE_URL}/rest/v1/invoice_bounce_alerts?status=eq.resolved&select=id&limit=1`,
      { headers: restHeaders },
    );
    expect(find.ok()).toBeTruthy();
    const rows = await find.json();
    test.skip(!rows.length, 'No resolved bounce rows available — seed via cleanup first');

    const res = await request.post(`${SUPABASE_URL}/functions/v1/resend-bounced-email`, {
      headers: fnHeaders,
      data: { bounce_alert_id: rows[0].id, to: 'real@example.com' },
    });
    expect(res.status()).toBe(409);
    const b = await res.json();
    expect(b.success).toBe(false);
    expect(b.error).toContain('already resolved');
  });
});

test.describe('invoice_bounce_alerts table read access', () => {
  test('anon role can SELECT (RLS allows anon read)', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/invoice_bounce_alerts?select=id,status&limit=1`,
      { headers: restHeaders },
    );
    expect(res.ok()).toBeTruthy();
    // Either returns rows or returns []; both are valid (just shouldn't 401/403)
    const rows = await res.json();
    expect(Array.isArray(rows)).toBe(true);
  });

  test('every category value matches the CHECK constraint', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/invoice_bounce_alerts?select=category&limit=200`,
      { headers: restHeaders },
    );
    expect(res.ok()).toBeTruthy();
    const rows = await res.json();
    const allowed = new Set(['invoice', 'document_share', 'project_invite', 'report_delivery', 'platform_notice', 'unknown']);
    for (const r of rows) {
      expect(allowed.has(r.category)).toBe(true);
    }
  });
});
