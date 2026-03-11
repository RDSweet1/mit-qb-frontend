/**
 * Monitoring & Oversight Edge Function Tests
 *
 * Tests the monitoring edge functions added for system health:
 * - self-heal: detects and repairs common failure modes
 * - automation-health-digest: daily summary of automation health
 * - midweek-oversight: midweek check on automation status
 * - sync-customer-emails: syncs customer emails from QB Online
 *
 * All invocations use { manual: true } to bypass schedule gates.
 */
import { test, expect } from '@playwright/test';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const fnHeaders = {
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

// ==================================================================
// CORS preflight — verify all monitoring functions are deployed
// ==================================================================

test.describe('Monitoring functions — deployment', () => {
  const monitoringFunctions = [
    'self-heal',
    'automation-health-digest',
    'midweek-oversight',
    'sync-customer-emails',
  ];

  for (const fn of monitoringFunctions) {
    test(`${fn} returns 200 on OPTIONS (deployed)`, async ({ request }) => {
      const res = await request.fetch(
        `${SUPABASE_URL}/functions/v1/${fn}`,
        { method: 'OPTIONS', headers: fnHeaders }
      );
      expect(res.status()).toBe(200);
    });
  }
});

// ==================================================================
// self-heal
// ==================================================================

test.describe('self-heal', () => {
  test('manual invocation returns success with expected shape', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/self-heal`,
      {
        headers: fnHeaders,
        data: { manual: true },
      }
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();

    expect(body.success).toBe(true);
    // When no issues found, returns { message, repaired: 0 }
    // When issues found, returns { alertsFound, repaired, escalated, details }
    if (body.message) {
      expect(body.repaired).toBe(0);
    } else {
      expect(typeof body.alertsFound).toBe('number');
      expect(typeof body.repaired).toBe('number');
      expect(typeof body.escalated).toBe('number');
      expect(Array.isArray(body.details)).toBeTruthy();
    }
  });
});

// ==================================================================
// automation-health-digest
// ==================================================================

test.describe('automation-health-digest', () => {
  test('manual invocation returns success with expected shape', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/automation-health-digest`,
      {
        headers: fnHeaders,
        data: { manual: true },
      }
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(typeof body.allOk).toBe('boolean');
    expect(typeof body.functionsChecked).toBe('number');
    expect(typeof body.hasErrors).toBe('boolean');
    expect(typeof body.hasStale).toBe('boolean');
    expect(typeof body.emailSent).toBe('boolean');
    expect(typeof body.selfHealTriggered).toBe('boolean');
    // When issues exist, selfHealResult should be present
    if (body.selfHealTriggered) {
      expect(body.selfHealResult).toBeTruthy();
      expect(typeof body.selfHealResult.success).toBe('boolean');
    }
  });
});

// ==================================================================
// midweek-oversight
// ==================================================================

test.describe('midweek-oversight', () => {
  test('manual invocation returns success with expected shape', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/midweek-oversight`,
      {
        headers: fnHeaders,
        data: { manual: true },
      }
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();

    expect(body.success).toBe(true);
  });
});

// ==================================================================
// sync-customer-emails
// ==================================================================

test.describe('sync-customer-emails', () => {
  test('manual invocation returns success with expected shape', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/sync-customer-emails`,
      {
        headers: fnHeaders,
        data: { manual: true },
      }
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(typeof body.total_qb_customers).toBe('number');
    expect(typeof body.emails_found).toBe('number');
    expect(typeof body.emails_updated).toBe('number');
    expect(typeof body.errors).toBe('number');
  });
});
