/**
 * Phase 2: Database Table Schema & RLS Tests
 *
 * Tests tables NOT already covered by customer-profitability.spec.ts and
 * schedule-config.spec.ts:
 *   time_entries, customers, service_items, app_users,
 *   report_periods, function_metrics, time_entry_audit_log
 *
 * NOTE: app_users is NOT readable by anon via REST API — tested accordingly.
 * NOTE: function_metrics has permissive RLS (anon can insert/delete) — tested accordingly.
 */
import { test, expect } from '@playwright/test';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

// ==================================================================
// time_entries
// ==================================================================

test.describe('time_entries table', () => {
  test('anon can SELECT rows', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/time_entries?order=id.desc&limit=5`,
      { headers }
    );
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data)).toBeTruthy();
    expect(data.length).toBeGreaterThan(0);
  });

  test('rows have required columns', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/time_entries?limit=3`,
      { headers }
    );
    const data = await res.json();
    for (const row of data) {
      expect(row.id).toBeDefined();
      expect(row.employee_name).toBeTruthy();
      // Date column is txn_date, not date
      expect(row.txn_date).toBeTruthy();
      // Customer ref is qb_customer_id (holds name, not numeric ID)
      expect(row.qb_customer_id).toBeDefined();
      expect(typeof row.is_locked).toBe('boolean');
      expect(typeof row.manually_edited).toBe('boolean');
    }
  });

  test('anon cannot INSERT into time_entries', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/rest/v1/time_entries`,
      {
        headers: { ...headers, Prefer: 'return=representation' },
        data: { employee_name: 'Hacker', txn_date: '2020-01-01', hours: 1 },
      }
    );
    expect(res.ok()).toBeFalsy();
  });

  test('anon cannot DELETE from time_entries', async ({ request }) => {
    const res = await request.delete(
      `${SUPABASE_URL}/rest/v1/time_entries?id=eq.1`,
      { headers: { ...headers, Prefer: 'return=representation' } }
    );
    // PostgREST returns 200 with empty array when RLS blocks
    const data = await res.json();
    expect(Array.isArray(data) ? data.length : 0).toBe(0);
  });
});

// ==================================================================
// customers
// ==================================================================

test.describe('customers table', () => {
  test('anon can SELECT rows', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/customers?limit=5`,
      { headers }
    );
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data)).toBeTruthy();
    expect(data.length).toBeGreaterThan(0);
  });

  test('rows have required columns', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/customers?limit=3`,
      { headers }
    );
    const data = await res.json();
    for (const row of data) {
      expect(row.id).toBeDefined();
      expect(row.display_name).toBeTruthy();
    }
  });

  test('anon cannot INSERT into customers', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/rest/v1/customers`,
      {
        headers: { ...headers, Prefer: 'return=representation' },
        data: { display_name: 'Fake Customer' },
      }
    );
    expect(res.ok()).toBeFalsy();
  });

  test('anon UPDATE of display_name is silently blocked by trigger guard', async ({ request }) => {
    // First, get a real customer to test against
    const listRes = await request.get(
      `${SUPABASE_URL}/rest/v1/customers?limit=1&select=id,display_name`,
      { headers }
    );
    const customers = await listRes.json();
    if (customers.length === 0) return;

    const original = customers[0];

    // Attempt to change display_name — the trigger should silently revert it
    await request.patch(
      `${SUPABASE_URL}/rest/v1/customers?id=eq.${original.id}`,
      {
        headers: { ...headers, Prefer: 'return=representation' },
        data: { display_name: 'Hacked Name' },
      }
    );

    // Re-read — display_name should be unchanged
    const verifyRes = await request.get(
      `${SUPABASE_URL}/rest/v1/customers?id=eq.${original.id}&select=display_name`,
      { headers }
    );
    const after = await verifyRes.json();
    expect(after[0].display_name).toBe(original.display_name);
  });

  test('anon CAN update skip_acceptance_gate (invoice override toggle)', async ({ request }) => {
    // Get a customer and read current skip_acceptance_gate value
    const listRes = await request.get(
      `${SUPABASE_URL}/rest/v1/customers?limit=1&select=id,skip_acceptance_gate`,
      { headers }
    );
    const customers = await listRes.json();
    if (customers.length === 0) return;

    const original = customers[0];
    const flipped = !original.skip_acceptance_gate;

    // Toggle skip_acceptance_gate
    const updateRes = await request.patch(
      `${SUPABASE_URL}/rest/v1/customers?id=eq.${original.id}`,
      {
        headers: { ...headers, Prefer: 'return=representation' },
        data: { skip_acceptance_gate: flipped },
      }
    );
    expect(updateRes.ok()).toBeTruthy();

    // Verify it changed
    const verifyRes = await request.get(
      `${SUPABASE_URL}/rest/v1/customers?id=eq.${original.id}&select=skip_acceptance_gate`,
      { headers }
    );
    const after = await verifyRes.json();
    expect(after[0].skip_acceptance_gate).toBe(flipped);

    // Restore original value
    await request.patch(
      `${SUPABASE_URL}/rest/v1/customers?id=eq.${original.id}`,
      {
        headers: { ...headers, Prefer: 'return=representation' },
        data: { skip_acceptance_gate: original.skip_acceptance_gate },
      }
    );
  });

  test('anon cannot DELETE from customers', async ({ request }) => {
    const res = await request.delete(
      `${SUPABASE_URL}/rest/v1/customers?id=eq.1`,
      { headers: { ...headers, Prefer: 'return=representation' } }
    );
    const data = await res.json();
    expect(Array.isArray(data) ? data.length : 0).toBe(0);
  });
});

// ==================================================================
// service_items
// ==================================================================

test.describe('service_items table', () => {
  test('anon can SELECT rows', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/service_items?limit=5`,
      { headers }
    );
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data)).toBeTruthy();
    expect(data.length).toBeGreaterThan(0);
  });

  test('rows have required columns', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/service_items?limit=3`,
      { headers }
    );
    const data = await res.json();
    for (const row of data) {
      expect(row.id).toBeDefined();
      expect(row.name).toBeTruthy();
    }
  });

  test('anon cannot INSERT into service_items', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/rest/v1/service_items`,
      {
        headers: { ...headers, Prefer: 'return=representation' },
        data: { name: 'Fake Item', qb_item_id: 'fake' },
      }
    );
    expect(res.ok()).toBeFalsy();
  });

  test('anon cannot DELETE from service_items', async ({ request }) => {
    const res = await request.delete(
      `${SUPABASE_URL}/rest/v1/service_items?id=eq.1`,
      { headers: { ...headers, Prefer: 'return=representation' } }
    );
    const data = await res.json();
    expect(Array.isArray(data) ? data.length : 0).toBe(0);
  });
});

// ==================================================================
// app_users (RLS blocks anon SELECT — verified)
// ==================================================================

test.describe('app_users table', () => {
  test('anon SELECT returns empty (RLS blocks read)', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/app_users?limit=5`,
      { headers }
    );
    // RLS blocks anon from reading app_users — returns 200 with []
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data)).toBeTruthy();
    expect(data.length).toBe(0);
  });

  test('anon cannot INSERT into app_users', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/rest/v1/app_users`,
      {
        headers: { ...headers, Prefer: 'return=representation' },
        data: { email: 'fake@test.com', display_name: 'Fake' },
      }
    );
    expect(res.ok()).toBeFalsy();
  });

  test('anon cannot DELETE from app_users', async ({ request }) => {
    const res = await request.delete(
      `${SUPABASE_URL}/rest/v1/app_users?id=eq.1`,
      { headers: { ...headers, Prefer: 'return=representation' } }
    );
    const data = await res.json();
    expect(Array.isArray(data) ? data.length : 0).toBe(0);
  });
});

// ==================================================================
// report_periods
// ==================================================================

test.describe('report_periods table', () => {
  test('anon can SELECT rows', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/report_periods?order=id.desc&limit=5`,
      { headers }
    );
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('rows have required columns (if data exists)', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/report_periods?limit=3`,
      { headers }
    );
    const data = await res.json();
    if (data.length === 0) return; // table may be empty in fresh environments

    for (const row of data) {
      expect(row.id).toBeDefined();
      expect(row.customer_name).toBeDefined();
      expect(row.week_start).toBeDefined();
      expect(row.status).toBeDefined();
    }
  });

  test('anon cannot INSERT into report_periods', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/rest/v1/report_periods`,
      {
        headers: { ...headers, Prefer: 'return=representation' },
        data: { customer_name: 'Fake', week_start: '2020-01-06', status: 'pending' },
      }
    );
    expect(res.ok()).toBeFalsy();
  });

  test('anon cannot UPDATE report_periods', async ({ request }) => {
    const res = await request.patch(
      `${SUPABASE_URL}/rest/v1/report_periods?id=eq.1`,
      {
        headers: { ...headers, Prefer: 'return=representation' },
        data: { status: 'hacked' },
      }
    );
    const data = await res.json();
    expect(Array.isArray(data) ? data.length : 0).toBe(0);
  });

  test('anon cannot DELETE from report_periods', async ({ request }) => {
    const res = await request.delete(
      `${SUPABASE_URL}/rest/v1/report_periods?id=eq.1`,
      { headers: { ...headers, Prefer: 'return=representation' } }
    );
    const data = await res.json();
    expect(Array.isArray(data) ? data.length : 0).toBe(0);
  });
});

// ==================================================================
// function_metrics (permissive RLS — anon has full access)
// ==================================================================

test.describe('function_metrics table', () => {
  test('anon can SELECT rows', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/function_metrics?order=id.desc&limit=5`,
      { headers }
    );
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data)).toBeTruthy();
    // May be empty — that's ok, just verify the query works
  });

  test('rows have expected columns (if data exists)', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/function_metrics?order=id.desc&limit=3`,
      { headers }
    );
    const data = await res.json();
    if (data.length === 0) return;

    for (const row of data) {
      expect(row.id).toBeDefined();
      expect(row.function_name).toBeTruthy();
      expect(row.status).toBeDefined();
      expect(row.duration_ms).toBeDefined();
    }
  });

  // function_metrics has permissive RLS — anon CAN insert (and delete own rows).
  // Edge functions invoked via anon key need to write metrics.
  test('anon CAN insert into function_metrics (permissive RLS)', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/rest/v1/function_metrics`,
      {
        headers: { ...headers, Prefer: 'return=representation' },
        data: {
          function_name: 'test-rls-verify',
          status: 'success',
          duration_ms: 1,
        },
      }
    );
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.length).toBe(1);

    // Cleanup
    if (data[0]?.id) {
      await request.delete(
        `${SUPABASE_URL}/rest/v1/function_metrics?id=eq.${data[0].id}`,
        { headers: { ...headers, Prefer: 'return=representation' } }
      );
    }
  });
});

// ==================================================================
// time_entry_audit_log
// ==================================================================

test.describe('time_entry_audit_log table', () => {
  test('anon can SELECT rows', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/time_entry_audit_log?order=id.desc&limit=5`,
      { headers }
    );
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('rows have expected columns (if data exists)', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/time_entry_audit_log?order=id.desc&limit=3`,
      { headers }
    );
    const data = await res.json();
    if (data.length === 0) return;

    for (const row of data) {
      expect(row.id).toBeDefined();
      expect(row.entry_id).toBeDefined();
    }
  });

  test('anon cannot INSERT into time_entry_audit_log', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/rest/v1/time_entry_audit_log`,
      {
        headers: { ...headers, Prefer: 'return=representation' },
        data: { entry_id: 1, action: 'fake' },
      }
    );
    expect(res.ok()).toBeFalsy();
  });

  test('anon cannot DELETE from time_entry_audit_log', async ({ request }) => {
    const res = await request.delete(
      `${SUPABASE_URL}/rest/v1/time_entry_audit_log?id=eq.1`,
      { headers: { ...headers, Prefer: 'return=representation' } }
    );
    const data = await res.json();
    expect(Array.isArray(data) ? data.length : 0).toBe(0);
  });
});
