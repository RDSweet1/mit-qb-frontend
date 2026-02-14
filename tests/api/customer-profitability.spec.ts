import { test, expect } from '@playwright/test';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

test.describe('customer_profitability API', () => {
  test('anon can read customer profitability data', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/customer_profitability?order=week_start.desc&limit=10`,
      { headers }
    );
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('rows have all required fields', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/customer_profitability?limit=5`,
      { headers }
    );
    const data = await res.json();

    // Skip if no data yet
    if (data.length === 0) return;

    for (const row of data) {
      expect(row.id).toBeDefined();
      expect(row.week_start).toBeTruthy();
      expect(row.week_end).toBeTruthy();
      expect(row.qb_customer_id).toBeTruthy();
      // DECIMAL columns may come back as number or string depending on Supabase version
      expect(row.total_hours).toBeDefined();
      expect(row.billable_hours).toBeDefined();
      expect(row.billable_revenue).toBeDefined();
      expect(row.labor_cost).toBeDefined();
      expect(row.margin).toBeDefined();
      expect(row.margin_percent).toBeDefined();
      expect(row.entry_count).toBeDefined();
    }
  });

  test('can filter by qb_customer_id', async ({ request }) => {
    // First get any existing customer ID
    const allRes = await request.get(
      `${SUPABASE_URL}/rest/v1/customer_profitability?select=qb_customer_id&limit=1`,
      { headers }
    );
    const allData = await allRes.json();
    if (allData.length === 0) return;

    const customerId = allData[0].qb_customer_id;

    // Filter by that customer
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/customer_profitability?qb_customer_id=eq.${customerId}&order=week_start.asc`,
      { headers }
    );
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.length).toBeGreaterThan(0);

    // All rows should be for that customer
    for (const row of data) {
      expect(row.qb_customer_id).toBe(customerId);
    }
  });

  test('can filter by date range', async ({ request }) => {
    // Get the most recent week_start
    const latestRes = await request.get(
      `${SUPABASE_URL}/rest/v1/customer_profitability?select=week_start&order=week_start.desc&limit=1`,
      { headers }
    );
    const latestData = await latestRes.json();
    if (latestData.length === 0) return;

    const latestWeek = latestData[0].week_start;

    // Filter to just that week
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/customer_profitability?week_start=eq.${latestWeek}`,
      { headers }
    );
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.length).toBeGreaterThan(0);

    for (const row of data) {
      expect(row.week_start).toBe(latestWeek);
    }
  });

  test('breakdown_by_employee is valid JSONB', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/customer_profitability?select=breakdown_by_employee&limit=5`,
      { headers }
    );
    const data = await res.json();
    if (data.length === 0) return;

    for (const row of data) {
      expect(typeof row.breakdown_by_employee).toBe('object');

      // Each employee entry should have hours, cost, revenue
      for (const [name, emp] of Object.entries(row.breakdown_by_employee as Record<string, any>)) {
        expect(typeof name).toBe('string');
        expect(typeof emp.hours).toBe('number');
        expect(typeof emp.cost).toBe('number');
        expect(typeof emp.revenue).toBe('number');
      }
    }
  });

  test('breakdown_by_service is valid JSONB', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/customer_profitability?select=breakdown_by_service&limit=5`,
      { headers }
    );
    const data = await res.json();
    if (data.length === 0) return;

    for (const row of data) {
      expect(typeof row.breakdown_by_service).toBe('object');

      // Each service entry should have hours, revenue, count
      for (const [name, si] of Object.entries(row.breakdown_by_service as Record<string, any>)) {
        expect(typeof name).toBe('string');
        expect(typeof si.hours).toBe('number');
        expect(typeof si.revenue).toBe('number');
        expect(typeof si.count).toBe('number');
      }
    }
  });

  test('margin_percent is consistent with revenue and cost', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/customer_profitability?limit=10`,
      { headers }
    );
    const data = await res.json();
    if (data.length === 0) return;

    for (const row of data) {
      const revenue = parseFloat(row.billable_revenue);
      const cost = parseFloat(row.labor_cost);
      const margin = parseFloat(row.margin);
      const marginPct = parseFloat(row.margin_percent);

      // Margin should be revenue - cost (within rounding tolerance)
      expect(Math.abs(margin - (revenue - cost))).toBeLessThan(0.1);

      // Margin percent should be (margin / revenue) * 100
      if (revenue > 0) {
        const expectedPct = (margin / revenue) * 100;
        expect(Math.abs(marginPct - expectedPct)).toBeLessThan(1);
      }
    }
  });

  test('unique constraint on (week_start, qb_customer_id) prevents duplicates', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/customer_profitability?select=week_start,qb_customer_id`,
      { headers }
    );
    const data = await res.json();
    if (data.length === 0) return;

    // Check for duplicates
    const keys = data.map((r: any) => `${r.week_start}::${r.qb_customer_id}`);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  test('anon cannot insert into customer_profitability', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/rest/v1/customer_profitability`,
      {
        headers: { ...headers, Prefer: 'return=representation' },
        data: {
          week_start: '2020-01-06',
          week_end: '2020-01-12',
          qb_customer_id: 'test-fake-id',
          customer_name: 'Test Customer',
          total_hours: 10,
        },
      }
    );
    // Should fail — no INSERT policy for anon
    expect(res.ok()).toBeFalsy();
  });

  test('anon cannot update customer_profitability', async ({ request }) => {
    const res = await request.patch(
      `${SUPABASE_URL}/rest/v1/customer_profitability?id=eq.1`,
      {
        headers: { ...headers, Prefer: 'return=representation' },
        data: { customer_name: 'Hacked Name' },
      }
    );
    // PostgREST returns 200 but with empty array when RLS blocks the operation
    const data = await res.json();
    expect(Array.isArray(data) ? data.length : 0).toBe(0);
  });
});
