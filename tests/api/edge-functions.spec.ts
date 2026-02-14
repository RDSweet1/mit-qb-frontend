import { test, expect } from '@playwright/test';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const fnHeaders = {
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

const restHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

test.describe('Edge Function Schedule Gate', () => {
  test('weekly-profitability-report with manual:true bypasses gate', async ({ request }) => {
    // Use a historical week that already has data to avoid side effects
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/weekly-profitability-report`,
      {
        headers: fnHeaders,
        data: {
          weekStart: '2026-02-02',
          weekEnd: '2026-02-08',
          skipEmail: true,
          manual: true,
        },
      }
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();

    // Should succeed regardless of schedule config
    expect(body.success).toBe(true);
    expect(body.snapshot).toBeDefined();
    expect(body.snapshot.weekStart).toBe('2026-02-02');
    expect(body.snapshot.weekEnd).toBe('2026-02-08');
    expect(typeof body.snapshot.totalHours).toBe('number');
    expect(typeof body.snapshot.billableRevenue).toBe('number');
    expect(typeof body.snapshot.marginPercent).toBe('number');
    expect(typeof body.customerCount).toBe('number');
  });

  test('weekly-profitability-report generates customer profitability rows', async ({ request }) => {
    // Run the function for a known week
    const fnRes = await request.post(
      `${SUPABASE_URL}/functions/v1/weekly-profitability-report`,
      {
        headers: fnHeaders,
        data: {
          weekStart: '2026-02-02',
          weekEnd: '2026-02-08',
          skipEmail: true,
          manual: true,
        },
      }
    );
    const fnBody = await fnRes.json();
    expect(fnBody.success).toBe(true);
    expect(fnBody.customerCount).toBeGreaterThan(0);

    // Verify customer_profitability table has rows for that week
    const dbRes = await request.get(
      `${SUPABASE_URL}/rest/v1/customer_profitability?week_start=eq.2026-02-02`,
      { headers: restHeaders }
    );
    expect(dbRes.ok()).toBeTruthy();
    const rows = await dbRes.json();
    expect(rows.length).toBe(fnBody.customerCount);

    // Each row should have valid data
    for (const row of rows) {
      expect(row.qb_customer_id).toBeTruthy();
      expect(row.customer_name).toBeTruthy();
      expect(parseFloat(row.total_hours)).toBeGreaterThanOrEqual(0);
    }
  });

  test('weekly-profitability-report snapshot contains expected fields', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/weekly-profitability-report`,
      {
        headers: fnHeaders,
        data: {
          weekStart: '2026-02-02',
          weekEnd: '2026-02-08',
          skipEmail: true,
          manual: true,
        },
      }
    );
    const body = await res.json();
    const snap = body.snapshot;

    // All expected fields should be present
    expect(snap).toHaveProperty('weekStart');
    expect(snap).toHaveProperty('weekEnd');
    expect(snap).toHaveProperty('totalHours');
    expect(snap).toHaveProperty('billableHours');
    expect(snap).toHaveProperty('overheadHours');
    expect(snap).toHaveProperty('billableRevenue');
    expect(snap).toHaveProperty('laborCost');
    expect(snap).toHaveProperty('nonPayrollOverhead');
    expect(snap).toHaveProperty('totalCost');
    expect(snap).toHaveProperty('grossMargin');
    expect(snap).toHaveProperty('marginPercent');
    expect(snap).toHaveProperty('utilizationPercent');
    expect(snap).toHaveProperty('unbilledEntryCount');
    expect(snap).toHaveProperty('unbilledHours');

    // Verify calculations are consistent
    expect(snap.totalCost).toBeCloseTo(snap.laborCost + snap.nonPayrollOverhead, 1);
    expect(snap.grossMargin).toBeCloseTo(snap.billableRevenue - snap.totalCost, 1);
    expect(snap.totalHours).toBeCloseTo(snap.billableHours + snap.overheadHours, 1);
    if (snap.billableRevenue > 0) {
      expect(snap.marginPercent).toBeCloseTo((snap.grossMargin / snap.billableRevenue) * 100, 0);
    }
    if (snap.totalHours > 0) {
      expect(snap.utilizationPercent).toBeCloseTo((snap.billableHours / snap.totalHours) * 100, 0);
    }
  });

  test('gated function returns skipped when paused', async ({ request }) => {
    // First, pause the weekly-profitability-report in schedule_config
    const pauseRes = await request.patch(
      `${SUPABASE_URL}/rest/v1/schedule_config?function_name=eq.weekly-profitability-report`,
      {
        headers: { ...restHeaders, Prefer: 'return=representation' },
        data: { is_paused: true, paused_by: 'test' },
      }
    );
    expect(pauseRes.ok()).toBeTruthy();

    try {
      // Call without manual:true — gate should block it
      const res = await request.post(
        `${SUPABASE_URL}/functions/v1/weekly-profitability-report`,
        {
          headers: fnHeaders,
          data: {
            weekStart: '2026-02-02',
            weekEnd: '2026-02-08',
            skipEmail: true,
            // no manual:true — gate is active
          },
        }
      );
      expect(res.ok()).toBeTruthy();
      const body = await res.json();

      // Should be skipped due to pause
      expect(body.skipped).toBe(true);
      expect(body.reason).toBe('paused');
    } finally {
      // Always restore — resume the function
      await request.patch(
        `${SUPABASE_URL}/rest/v1/schedule_config?function_name=eq.weekly-profitability-report`,
        {
          headers: { ...restHeaders, Prefer: 'return=representation' },
          data: { is_paused: false, paused_by: null, paused_at: null },
        }
      );
    }
  });

  test('gated function still works with manual:true even when paused', async ({ request }) => {
    // Pause the function
    await request.patch(
      `${SUPABASE_URL}/rest/v1/schedule_config?function_name=eq.weekly-profitability-report`,
      {
        headers: { ...restHeaders, Prefer: 'return=representation' },
        data: { is_paused: true, paused_by: 'test' },
      }
    );

    try {
      // Call WITH manual:true — should bypass the gate
      const res = await request.post(
        `${SUPABASE_URL}/functions/v1/weekly-profitability-report`,
        {
          headers: fnHeaders,
          data: {
            weekStart: '2026-02-02',
            weekEnd: '2026-02-08',
            skipEmail: true,
            manual: true,
          },
        }
      );
      expect(res.ok()).toBeTruthy();
      const body = await res.json();

      // Should succeed despite being paused
      expect(body.success).toBe(true);
      expect(body.skipped).toBeUndefined();
    } finally {
      // Restore
      await request.patch(
        `${SUPABASE_URL}/rest/v1/schedule_config?function_name=eq.weekly-profitability-report`,
        {
          headers: { ...restHeaders, Prefer: 'return=representation' },
          data: { is_paused: false, paused_by: null, paused_at: null },
        }
      );
    }
  });

  test('schedule_config last_run_status updates after gated skip', async ({ request }) => {
    // Pause the function
    await request.patch(
      `${SUPABASE_URL}/rest/v1/schedule_config?function_name=eq.weekly-profitability-report`,
      {
        headers: { ...restHeaders, Prefer: 'return=representation' },
        data: { is_paused: true, paused_by: 'test' },
      }
    );

    try {
      // Trigger without manual — should be skipped
      await request.post(
        `${SUPABASE_URL}/functions/v1/weekly-profitability-report`,
        {
          headers: fnHeaders,
          data: { weekStart: '2026-02-02', weekEnd: '2026-02-08', skipEmail: true },
        }
      );

      // Check that last_run_status was updated to skipped_paused
      const configRes = await request.get(
        `${SUPABASE_URL}/rest/v1/schedule_config?function_name=eq.weekly-profitability-report`,
        { headers: restHeaders }
      );
      const [config] = await configRes.json();
      expect(config.last_run_status).toBe('skipped_paused');
      expect(config.last_run_at).toBeTruthy();
    } finally {
      // Restore
      await request.patch(
        `${SUPABASE_URL}/rest/v1/schedule_config?function_name=eq.weekly-profitability-report`,
        {
          headers: { ...restHeaders, Prefer: 'return=representation' },
          data: { is_paused: false, paused_by: null, paused_at: null },
        }
      );
    }
  });
});
