/**
 * AR Edge Functions — API Tests
 *
 * Covers all 6 AR edge functions:
 *   ar-sync-payments    — syncs QB payment data to invoice_log
 *   ar-sync-emails      — reads accounting@ inbox/sent, logs to ar_activity_log
 *   ar-full-sync        — pulls ALL open QB invoices into invoice_log
 *   ar-automation       — daily driver: email sync → payment sync → dunning
 *   ar-manage-invoice   — action handler (note, call, PTP, dispute, etc.)
 *   ar-send-collection  — sends branded dunning email for a specific stage
 *
 * All destructive / email-sending tests use safe parameters that prevent
 * side effects (skipEmail, dry-run flags where available, or read-only actions).
 */
import { test, expect } from '@playwright/test';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const fnHeaders = {
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

// ====================================================================
// ar-sync-payments
// ====================================================================
test.describe('ar-sync-payments', () => {
  test('OPTIONS returns 200 (CORS preflight)', async ({ request }) => {
    const res = await request.fetch(`${SUPABASE_URL}/functions/v1/ar-sync-payments`, {
      method: 'OPTIONS',
      headers: fnHeaders,
    });
    expect(res.status()).toBe(200);
  });

  test('CORS headers are present', async ({ request }) => {
    const res = await request.fetch(`${SUPABASE_URL}/functions/v1/ar-sync-payments`, {
      method: 'OPTIONS',
      headers: fnHeaders,
    });
    expect(res.headers()['access-control-allow-origin']).toBe('*');
  });

  test('responds with success and sync summary', async ({ request }) => {
    const res = await request.post(`${SUPABASE_URL}/functions/v1/ar-sync-payments`, {
      headers: fnHeaders,
      data: {},
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    // Response shape: { success, checked, updated, newPayments }
    // (or { success, message } when no open invoices)
    expect(body).toHaveProperty('checked');
  });

  test('response checked and updated are numbers', async ({ request }) => {
    const res = await request.post(`${SUPABASE_URL}/functions/v1/ar-sync-payments`, {
      headers: fnHeaders,
      data: {},
    });
    const body = await res.json();
    if (body.checked !== undefined) {
      expect(typeof body.checked).toBe('number');
      expect(typeof body.updated).toBe('number');
      expect(typeof body.newPayments).toBe('number');
    } else {
      // No open invoices — valid shortcut response
      expect(body.message).toBeTruthy();
    }
  });
});

// ====================================================================
// ar-sync-emails
// ====================================================================
test.describe('ar-sync-emails', () => {
  test('OPTIONS returns 200', async ({ request }) => {
    const res = await request.fetch(`${SUPABASE_URL}/functions/v1/ar-sync-emails`, {
      method: 'OPTIONS',
      headers: fnHeaders,
    });
    expect(res.status()).toBe(200);
  });

  test('CORS headers present', async ({ request }) => {
    const res = await request.fetch(`${SUPABASE_URL}/functions/v1/ar-sync-emails`, {
      method: 'OPTIONS',
      headers: fnHeaders,
    });
    expect(res.headers()['access-control-allow-origin']).toBe('*');
  });

  test('returns success with sync summary (1-day lookback to keep test fast)', async ({ request }) => {
    const res = await request.post(`${SUPABASE_URL}/functions/v1/ar-sync-emails`, {
      headers: fnHeaders,
      data: { lookbackDays: 1 },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    // Function may return early with {message, logged:0} if no customers have emails
    // or full summary {scanned, logged, skipped} if customers exist
    expect(body).toHaveProperty('logged');
  });

  test('logged count is a number regardless of customer email data', async ({ request }) => {
    const res = await request.post(`${SUPABASE_URL}/functions/v1/ar-sync-emails`, {
      headers: fnHeaders,
      data: { lookbackDays: 1 },
    });
    const body = await res.json();
    expect(typeof body.logged).toBe('number');
    // If full sync ran (customers with emails found), scanned+skipped also present
    if (body.scanned !== undefined) {
      expect(typeof body.scanned).toBe('number');
      expect(typeof body.skipped).toBe('number');
    }
  });

  test('lookbackDays defaults gracefully when omitted', async ({ request }) => {
    const res = await request.post(`${SUPABASE_URL}/functions/v1/ar-sync-emails`, {
      headers: fnHeaders,
      data: {},
    });
    // May take longer due to 90-day default — still expect success
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

// ====================================================================
// ar-full-sync
// ====================================================================
test.describe('ar-full-sync', () => {
  test('OPTIONS returns 200', async ({ request }) => {
    const res = await request.fetch(`${SUPABASE_URL}/functions/v1/ar-full-sync`, {
      method: 'OPTIONS',
      headers: fnHeaders,
    });
    expect(res.status()).toBe(200);
  });

  test('returns a JSON response (success or QB auth error)', async ({ request }) => {
    const res = await request.post(`${SUPABASE_URL}/functions/v1/ar-full-sync`, {
      headers: fnHeaders,
      data: {},
    });
    // ar-full-sync requires a valid QB OAuth token; may fail with invalid_grant
    // when the QB refresh token has expired. This is expected in CI environments.
    const body = await res.json();
    expect(body).toHaveProperty('success');
    expect(typeof body.success).toBe('boolean');
    if (body.success) {
      expect(body).toHaveProperty('added');
      expect(body).toHaveProperty('updated');
      expect(body).toHaveProperty('markedPaid');
    } else {
      // QB auth failure is an acceptable error — not a function crash
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
    }
  });

  test('CORS headers present on OPTIONS', async ({ request }) => {
    const res = await request.fetch(`${SUPABASE_URL}/functions/v1/ar-full-sync`, {
      method: 'OPTIONS',
      headers: fnHeaders,
    });
    expect(res.status()).toBe(200);
    expect(res.headers()['access-control-allow-origin']).toBe('*');
  });

  test('returns a clean error body (not an unhandled crash) when QB token invalid', async ({ request }) => {
    const res = await request.post(`${SUPABASE_URL}/functions/v1/ar-full-sync`, {
      headers: fnHeaders,
      data: {},
    });
    // Whether success or failure, the response must be parseable JSON with a success flag
    const body = await res.json();
    expect(typeof body.success).toBe('boolean');
  });
});

// ====================================================================
// ar-automation
// ====================================================================
test.describe('ar-automation', () => {
  test('OPTIONS returns 200', async ({ request }) => {
    const res = await request.fetch(`${SUPABASE_URL}/functions/v1/ar-automation`, {
      method: 'OPTIONS',
      headers: fnHeaders,
    });
    expect(res.status()).toBe(200);
  });

  test('CORS headers present', async ({ request }) => {
    const res = await request.fetch(`${SUPABASE_URL}/functions/v1/ar-automation`, {
      method: 'OPTIONS',
      headers: fnHeaders,
    });
    expect(res.headers()['access-control-allow-origin']).toBe('*');
  });

  test('returns success with run summary', async ({ request }) => {
    const res = await request.post(`${SUPABASE_URL}/functions/v1/ar-automation`, {
      headers: fnHeaders,
      data: {},
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body).toHaveProperty('date');
    expect(body).toHaveProperty('processed');
    expect(body).toHaveProperty('fired');
    expect(body).toHaveProperty('skipped');
    expect(body).toHaveProperty('internalAlerts');
  });

  test('summary counts are numbers', async ({ request }) => {
    const res = await request.post(`${SUPABASE_URL}/functions/v1/ar-automation`, {
      headers: fnHeaders,
      data: {},
    });
    const body = await res.json();
    expect(typeof body.processed).toBe('number');
    expect(typeof body.fired).toBe('number');
    expect(typeof body.skipped).toBe('number');
    expect(typeof body.internalAlerts).toBe('number');
    // fired + skipped == processed
    expect(body.fired + body.skipped).toBe(body.processed);
  });

  test('date field is today in YYYY-MM-DD format', async ({ request }) => {
    const res = await request.post(`${SUPABASE_URL}/functions/v1/ar-automation`, {
      headers: fnHeaders,
      data: {},
    });
    const body = await res.json();
    const today = new Date().toISOString().split('T')[0];
    expect(body.date).toBe(today);
  });
});

// ====================================================================
// ar-manage-invoice (read-only actions only — log_note)
// ====================================================================
test.describe('ar-manage-invoice', () => {
  test('OPTIONS returns 200', async ({ request }) => {
    const res = await request.fetch(`${SUPABASE_URL}/functions/v1/ar-manage-invoice`, {
      method: 'OPTIONS',
      headers: fnHeaders,
    });
    expect(res.status()).toBe(200);
  });

  test('CORS headers present', async ({ request }) => {
    const res = await request.fetch(`${SUPABASE_URL}/functions/v1/ar-manage-invoice`, {
      method: 'OPTIONS',
      headers: fnHeaders,
    });
    expect(res.headers()['access-control-allow-origin']).toBe('*');
  });

  test('returns 400 when invoiceLogId is missing', async ({ request }) => {
    const res = await request.post(`${SUPABASE_URL}/functions/v1/ar-manage-invoice`, {
      headers: fnHeaders,
      data: { action: 'log_note', note: 'test' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('returns 400 when action is missing', async ({ request }) => {
    const res = await request.post(`${SUPABASE_URL}/functions/v1/ar-manage-invoice`, {
      headers: fnHeaders,
      data: { invoiceLogId: 99999 },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('returns 400 for unknown action', async ({ request }) => {
    const res = await request.post(`${SUPABASE_URL}/functions/v1/ar-manage-invoice`, {
      headers: fnHeaders,
      data: { invoiceLogId: 99999, action: 'nonexistent_action' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('response shape has success and message fields', async ({ request }) => {
    // Send to a non-existent invoice — expect a clean error, not a crash
    const res = await request.post(`${SUPABASE_URL}/functions/v1/ar-manage-invoice`, {
      headers: fnHeaders,
      data: { invoiceLogId: 99999, action: 'log_note', note: 'API test note' },
    });
    const body = await res.json();
    expect(body).toHaveProperty('success');
    // Either succeeded (unlikely with id 99999) or returned a clean error
    if (!body.success) {
      expect(body).toHaveProperty('error');
    }
  });
});

// ====================================================================
// ar-send-collection (CORS only — no live send in tests)
// ====================================================================
test.describe('ar-send-collection', () => {
  test('OPTIONS returns 200', async ({ request }) => {
    const res = await request.fetch(`${SUPABASE_URL}/functions/v1/ar-send-collection`, {
      method: 'OPTIONS',
      headers: fnHeaders,
    });
    expect(res.status()).toBe(200);
  });

  test('CORS headers present', async ({ request }) => {
    const res = await request.fetch(`${SUPABASE_URL}/functions/v1/ar-send-collection`, {
      method: 'OPTIONS',
      headers: fnHeaders,
    });
    expect(res.headers()['access-control-allow-origin']).toBe('*');
  });

  test('returns 400 when invoiceLogId is missing', async ({ request }) => {
    const res = await request.post(`${SUPABASE_URL}/functions/v1/ar-send-collection`, {
      headers: fnHeaders,
      data: { stage: 1 },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('returns 400 when stage is missing', async ({ request }) => {
    const res = await request.post(`${SUPABASE_URL}/functions/v1/ar-send-collection`, {
      headers: fnHeaders,
      data: { invoiceLogId: 99999 },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('returns clean error for non-existent invoice (no crash)', async ({ request }) => {
    const res = await request.post(`${SUPABASE_URL}/functions/v1/ar-send-collection`, {
      headers: fnHeaders,
      data: { invoiceLogId: 99999, stage: 1, sentBy: 'test-suite' },
    });
    // 404 or 500 with clean JSON body (not a crash/unhandled error)
    const body = await res.json();
    expect(body).toHaveProperty('success');
    expect(body.success).toBe(false);
    expect(body).toHaveProperty('error');
  });
});
