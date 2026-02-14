import { test, expect } from '@playwright/test';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

test.describe('schedule_config API', () => {
  test('anon can read all schedule configs', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/schedule_config?order=id.asc`,
      { headers }
    );
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data)).toBeTruthy();
    expect(data.length).toBe(5);
  });

  test('all 5 seeded automations have correct function names', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/schedule_config?order=id.asc`,
      { headers }
    );
    const data = await res.json();
    const names = data.map((r: any) => r.function_name);

    expect(names).toContain('send-reminder');
    expect(names).toContain('follow-up-reminders');
    expect(names).toContain('auto-accept');
    expect(names).toContain('report-reconciliation');
    expect(names).toContain('weekly-profitability-report');
  });

  test('each config has required fields', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/schedule_config?order=id.asc`,
      { headers }
    );
    const data = await res.json();

    for (const config of data) {
      expect(config.id).toBeDefined();
      expect(config.function_name).toBeTruthy();
      expect(config.display_name).toBeTruthy();
      expect(typeof config.is_paused).toBe('boolean');
      expect(config.schedule_day).toBeTruthy();
      expect(config.schedule_time).toBeTruthy();
      expect(config.timezone).toBeTruthy();
    }
  });

  test('schedule_day values are valid', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/schedule_config?select=schedule_day`,
      { headers }
    );
    const data = await res.json();
    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'weekdays', 'daily'];

    for (const row of data) {
      expect(validDays).toContain(row.schedule_day);
    }
  });

  test('anon can update schedule_day and schedule_time', async ({ request }) => {
    // Read the first config to get original values
    const readRes = await request.get(
      `${SUPABASE_URL}/rest/v1/schedule_config?function_name=eq.send-reminder`,
      { headers }
    );
    const [original] = await readRes.json();

    // Update to a new day/time
    const updateRes = await request.patch(
      `${SUPABASE_URL}/rest/v1/schedule_config?function_name=eq.send-reminder`,
      {
        headers,
        data: { schedule_day: 'tuesday', schedule_time: '10:00' },
      }
    );
    expect(updateRes.ok()).toBeTruthy();

    // Verify the update
    const verifyRes = await request.get(
      `${SUPABASE_URL}/rest/v1/schedule_config?function_name=eq.send-reminder`,
      { headers }
    );
    const [updated] = await verifyRes.json();
    expect(updated.schedule_day).toBe('tuesday');
    expect(updated.schedule_time).toContain('10:00');

    // Restore original values
    await request.patch(
      `${SUPABASE_URL}/rest/v1/schedule_config?function_name=eq.send-reminder`,
      {
        headers,
        data: {
          schedule_day: original.schedule_day,
          schedule_time: original.schedule_time,
        },
      }
    );
  });

  test('anon can pause and resume an automation', async ({ request }) => {
    // Read current state
    const readRes = await request.get(
      `${SUPABASE_URL}/rest/v1/schedule_config?function_name=eq.send-reminder`,
      { headers }
    );
    const [original] = await readRes.json();

    // Pause it
    const pauseRes = await request.patch(
      `${SUPABASE_URL}/rest/v1/schedule_config?function_name=eq.send-reminder`,
      {
        headers,
        data: { is_paused: true, paused_by: 'test', paused_at: new Date().toISOString() },
      }
    );
    expect(pauseRes.ok()).toBeTruthy();

    // Verify paused
    const verifyPaused = await request.get(
      `${SUPABASE_URL}/rest/v1/schedule_config?function_name=eq.send-reminder`,
      { headers }
    );
    const [paused] = await verifyPaused.json();
    expect(paused.is_paused).toBe(true);
    expect(paused.paused_by).toBe('test');

    // Resume it
    const resumeRes = await request.patch(
      `${SUPABASE_URL}/rest/v1/schedule_config?function_name=eq.send-reminder`,
      {
        headers,
        data: { is_paused: false, paused_by: null, paused_at: null },
      }
    );
    expect(resumeRes.ok()).toBeTruthy();

    // Verify resumed
    const verifyResumed = await request.get(
      `${SUPABASE_URL}/rest/v1/schedule_config?function_name=eq.send-reminder`,
      { headers }
    );
    const [resumed] = await verifyResumed.json();
    expect(resumed.is_paused).toBe(false);
    expect(resumed.paused_by).toBeNull();

    // Restore original state if it was paused before test
    if (original.is_paused !== resumed.is_paused) {
      await request.patch(
        `${SUPABASE_URL}/rest/v1/schedule_config?function_name=eq.send-reminder`,
        {
          headers,
          data: { is_paused: original.is_paused, paused_by: original.paused_by, paused_at: original.paused_at },
        }
      );
    }
  });

  test('anon cannot insert new schedule_config rows', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/rest/v1/schedule_config`,
      {
        headers,
        data: {
          function_name: 'test-function',
          display_name: 'Test',
          schedule_day: 'monday',
          schedule_time: '09:00',
        },
      }
    );
    // Should fail — no INSERT policy for anon
    expect(res.ok()).toBeFalsy();
  });

  test('anon cannot delete schedule_config rows', async ({ request }) => {
    const res = await request.delete(
      `${SUPABASE_URL}/rest/v1/schedule_config?function_name=eq.send-reminder`,
      { headers: { ...headers, Prefer: 'return=representation' } }
    );
    // PostgREST returns 200 but with empty array when RLS blocks the delete
    const data = await res.json();
    expect(Array.isArray(data) ? data.length : 0).toBe(0);

    // Verify the row still exists
    const verifyRes = await request.get(
      `${SUPABASE_URL}/rest/v1/schedule_config?function_name=eq.send-reminder`,
      { headers }
    );
    const rows = await verifyRes.json();
    expect(rows.length).toBe(1);
  });
});
