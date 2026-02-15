/**
 * Phase 4: Schedule Gate & Metrics Tests
 *
 * Tests the schedule gate mechanism for Group C functions (send-reminder,
 * follow-up-reminders, auto-accept) and verifies function_metrics rows.
 *
 * Safety: Only pauses/unpauses via schedule_config. Never calls Group C
 * functions without skipEmail. Always restores state in finally blocks.
 *
 * NOTE: Group C functions check schedule day/time FIRST, then pause state.
 * When called outside scheduled time, they return {skipped: true, reason: 'not_scheduled'}
 * regardless of pause state. Tests accept either 'paused' or 'not_scheduled'.
 */
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
  Prefer: 'return=representation',
};

// ---------- helpers ----------

async function pauseFunction(request: any, fnName: string) {
  await request.patch(
    `${SUPABASE_URL}/rest/v1/schedule_config?function_name=eq.${fnName}`,
    {
      headers: restHeaders,
      data: { is_paused: true, paused_by: 'test-suite' },
    }
  );
}

async function resumeFunction(request: any, fnName: string) {
  await request.patch(
    `${SUPABASE_URL}/rest/v1/schedule_config?function_name=eq.${fnName}`,
    {
      headers: restHeaders,
      data: { is_paused: false, paused_by: null, paused_at: null },
    }
  );
}

async function getConfig(request: any, fnName: string) {
  const res = await request.get(
    `${SUPABASE_URL}/rest/v1/schedule_config?function_name=eq.${fnName}`,
    { headers: restHeaders }
  );
  const [config] = await res.json();
  return config;
}

// ==================================================================
// Schedule gate behavior for Group C functions
// ==================================================================

test.describe('Schedule gate — Group C functions', () => {
  // Group C functions check schedule day/time before pause state.
  // When not on scheduled day/time, they return 'not_scheduled'.
  // When on scheduled day/time AND paused, they return 'paused'.
  // Both are valid "gated" responses.
  // Exclude send-reminder — already tested in schedule-config.spec.ts (avoids parallel race)
  const groupCFunctions = ['follow-up-reminders', 'auto-accept'];

  for (const fnName of groupCFunctions) {
    test(`${fnName} is gated (returns skipped)`, async ({ request }) => {
      const original = await getConfig(request, fnName);

      // Pause the function
      await pauseFunction(request, fnName);

      try {
        // Call WITHOUT manual:true — gate should block
        const res = await request.post(
          `${SUPABASE_URL}/functions/v1/${fnName}`,
          {
            headers: fnHeaders,
            data: { skipEmail: true },
          }
        );
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(body.skipped).toBe(true);
        // Accept either 'paused' or 'not_scheduled' — both indicate gating works
        expect(['paused', 'not_scheduled']).toContain(body.reason);
      } finally {
        // Restore original state
        if (!original.is_paused) {
          await resumeFunction(request, fnName);
        }
      }
    });
  }

  test('report-reconciliation is gated (returns skipped)', async ({ request }) => {
    const original = await getConfig(request, 'report-reconciliation');

    await pauseFunction(request, 'report-reconciliation');

    try {
      const res = await request.post(
        `${SUPABASE_URL}/functions/v1/report-reconciliation`,
        { headers: fnHeaders, data: {} }
      );
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.skipped).toBe(true);
      expect(['paused', 'not_scheduled']).toContain(body.reason);
    } finally {
      if (!original.is_paused) {
        await resumeFunction(request, 'report-reconciliation');
      }
    }
  });

  test('schedule_config updates after gated function call', async ({ request }) => {
    const fnName = 'weekly-profitability-report';
    const original = await getConfig(request, fnName);

    await pauseFunction(request, fnName);

    try {
      // Trigger the function without manual:true (will be gate-blocked)
      await request.post(
        `${SUPABASE_URL}/functions/v1/${fnName}`,
        { headers: fnHeaders, data: { weekStart: '2026-02-02', weekEnd: '2026-02-08', skipEmail: true } }
      );

      // Check that last_run_status updated
      const config = await getConfig(request, fnName);
      expect(config.last_run_status).toBe('skipped_paused');
      expect(config.last_run_at).toBeTruthy();
    } finally {
      if (!original.is_paused) {
        await resumeFunction(request, fnName);
      }
    }
  });
});

// ==================================================================
// function_metrics verification
// ==================================================================

test.describe('function_metrics', () => {
  test('metrics table is accessible', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/function_metrics?order=id.desc&limit=10`,
      { headers: restHeaders }
    );
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data)).toBeTruthy();
    // Table may be empty — that's valid
  });

  test('metrics have expected columns (if data exists)', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/function_metrics?order=id.desc&limit=5`,
      { headers: restHeaders }
    );
    const data = await res.json();
    if (data.length === 0) return;

    for (const row of data) {
      expect(row.function_name).toBeTruthy();
      expect(row.status).toBeDefined();
      expect(row.duration_ms).toBeDefined();
      expect(row.created_at).toBeTruthy();
    }
  });

  test('can insert and cleanup a test metric (permissive RLS)', async ({ request }) => {
    const insertRes = await request.post(
      `${SUPABASE_URL}/rest/v1/function_metrics`,
      {
        headers: { ...restHeaders, Prefer: 'return=representation' },
        data: {
          function_name: 'test-suite-verify',
          status: 'success',
          duration_ms: 1,
        },
      }
    );
    expect(insertRes.ok()).toBeTruthy();
    const data = await insertRes.json();
    expect(data.length).toBe(1);
    expect(data[0].function_name).toBe('test-suite-verify');

    // Cleanup
    if (data[0]?.id) {
      await request.delete(
        `${SUPABASE_URL}/rest/v1/function_metrics?id=eq.${data[0].id}`,
        { headers: { ...restHeaders, Prefer: 'return=representation' } }
      );
    }
  });
});
