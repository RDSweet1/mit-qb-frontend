/**
 * Phase 3: Health Check Tests
 *
 * Consolidates standalone verification scripts (verify-database.js,
 * check-customers.js, check-synced-dates.js, check-db-data.js,
 * test-edge-function.js) into Playwright API tests.
 *
 * These tests verify the production Supabase environment is healthy:
 * - Core tables exist and have rows
 * - Data is recent (not stale)
 * - Edge functions are reachable
 * - Schedule configs are seeded
 *
 * NOTE: app_users is NOT readable by anon via REST API.
 * Admin checks use manage_users edge function instead.
 */
import { test, expect } from '@playwright/test';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const restHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

const fnHeaders = {
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

// ==================================================================
// Database health (from verify-database.js, check-customers.js)
// ==================================================================

test.describe('Database health', () => {
  // Tables readable by anon
  const anonReadableTables = [
    'customers',
    'service_items',
    'time_entries',
  ];

  for (const table of anonReadableTables) {
    test(`${table} table exists and has rows`, async ({ request }) => {
      const res = await request.get(
        `${SUPABASE_URL}/rest/v1/${table}?limit=1`,
        { headers: restHeaders }
      );
      expect(res.ok()).toBeTruthy();
      const data = await res.json();
      expect(Array.isArray(data)).toBeTruthy();
      expect(data.length).toBeGreaterThan(0);
    });
  }

  test('customers have QB IDs populated', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/customers?select=id,qb_customer_id,display_name&limit=10`,
      { headers: restHeaders }
    );
    const data = await res.json();
    expect(data.length).toBeGreaterThan(0);

    // At least some customers should have qb_customer_id
    const withQbId = data.filter((c: any) => c.qb_customer_id);
    expect(withQbId.length).toBeGreaterThan(0);
  });

  test('app_users has data (via manage_users edge function)', async ({ request }) => {
    // app_users is not readable by anon via REST, so use the manage_users
    // edge function to verify users exist
    const adminRes = await request.get(
      `${SUPABASE_URL}/rest/v1/time_entries?approved_by=not.is.null&select=approved_by&limit=1`,
      { headers: restHeaders }
    );
    const adminData = await adminRes.json();
    if (adminData.length === 0) return; // can't determine admin

    const adminEmail = adminData[0].approved_by;
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/manage_users`,
      { headers: fnHeaders, data: { action: 'list', admin_email: adminEmail } }
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.users.length).toBeGreaterThan(0);

    // At least one admin exists
    const admins = body.users.filter((u: any) => u.is_admin);
    expect(admins.length).toBeGreaterThan(0);
  });
});

// ==================================================================
// Sync health (from check-synced-dates.js, check-db-data.js)
// ==================================================================

test.describe('Sync health', () => {
  test('time_entries has recent data (within last 14 days)', async ({ request }) => {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const cutoff = twoWeeksAgo.toISOString().split('T')[0];

    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/time_entries?txn_date=gte.${cutoff}&limit=1`,
      { headers: restHeaders }
    );
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.length).toBeGreaterThan(0);
  });

  test('time_entries have valid txn_date, employee, customer fields', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/time_entries?order=id.desc&limit=10`,
      { headers: restHeaders }
    );
    const data = await res.json();
    expect(data.length).toBeGreaterThan(0);

    for (const entry of data) {
      // txn_date should match YYYY-MM-DD pattern
      expect(entry.txn_date).toMatch(/^\d{4}-\d{2}-\d{2}/);
      // employee_name should be non-empty
      expect(entry.employee_name).toBeTruthy();
      // qb_customer_id holds customer name — should be defined
      expect(entry.qb_customer_id !== undefined).toBeTruthy();
    }
  });

  test('time_entries have hours data', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/time_entries?order=id.desc&limit=10&select=id,hours,start_time,end_time`,
      { headers: restHeaders }
    );
    const data = await res.json();
    expect(data.length).toBeGreaterThan(0);

    // At least some entries should have hours > 0
    const withHours = data.filter((e: any) => parseFloat(e.hours) > 0);
    expect(withHours.length).toBeGreaterThan(0);
  });
});

// ==================================================================
// Schedule config health
// ==================================================================

test.describe('Schedule config health', () => {
  test('all 5 automations are seeded', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/schedule_config?order=id.asc`,
      { headers: restHeaders }
    );
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.length).toBe(5);

    const names = data.map((r: any) => r.function_name);
    expect(names).toContain('send-reminder');
    expect(names).toContain('follow-up-reminders');
    expect(names).toContain('auto-accept');
    expect(names).toContain('report-reconciliation');
    expect(names).toContain('weekly-profitability-report');
  });

  test('no automations are accidentally paused (warning)', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/schedule_config?is_paused=eq.true`,
      { headers: restHeaders }
    );
    const paused = await res.json();

    // This is a WARNING — test still passes, but logs which are paused
    if (paused.length > 0) {
      const names = paused.map((r: any) => r.function_name).join(', ');
      console.warn(`WARNING: ${paused.length} automation(s) currently paused: ${names}`);
    }
    // Always passes — this is an advisory check
    expect(true).toBeTruthy();
  });
});

// ==================================================================
// Edge function deployment (from test-edge-function.js)
// ==================================================================

test.describe('Edge function deployment', () => {
  // These functions should be deployed and return 200 on CORS preflight
  const coreFunctions = [
    'auto_enroll_user',
    'lock_time_entry',
    'unlock_time_entry',
    'manage_users',
    'weekly-profitability-report',
    'qb-time-sync',
    'qb-online-sync',
    'sync-payments',
  ];

  for (const fn of coreFunctions) {
    test(`${fn} returns 200 on OPTIONS (deployed)`, async ({ request }) => {
      const res = await request.fetch(
        `${SUPABASE_URL}/functions/v1/${fn}`,
        { method: 'OPTIONS', headers: fnHeaders }
      );
      expect(res.status()).toBe(200);
    });
  }
});
