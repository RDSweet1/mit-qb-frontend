/**
 * pg_cron health checks
 *
 * Verifies that the four scheduled pg_cron jobs are:
 *   1. Registered and marked active in cron.job
 *   2. Actually firing (cron.job_run_details shows recent succeeded runs)
 *   3. Not stuck in a silent failure loop
 *
 * WHY THIS SUITE EXISTS
 * ─────────────────────
 * On 2026-04-13 we discovered that ALL pg_cron jobs had been silently
 * failing since the project was created because pg_net was never installed
 * ("schema net does not exist"). The jobs appeared registered and active
 * in cron.job but never produced any cron.job_run_details rows.
 * Self-heal, health-digest, midweek-oversight, and sync-customer-emails
 * were never running autonomously — only when manually triggered.
 *
 * The deployment-check tests (edge function OPTIONS 200) caught nothing
 * because they only verify the function is deployed, not that the cron
 * scheduler is actually reaching it.
 *
 * These tests catch that failure class directly.
 */

import { test, expect } from '@playwright/test';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// get_cron_job and get_cron_job_run_details are SECURITY DEFINER functions
// in the public schema — accessible with the anon key.
const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

// ─── helpers ────────────────────────────────────────────────────────────────

async function getCronJob(request: any, jobName: string) {
  const res = await request.post(
    `${SUPABASE_URL}/rest/v1/rpc/get_cron_job`,
    { headers, data: { p_name: jobName } }
  );
  expect(res.ok(), `get_cron_job RPC failed for ${jobName}`).toBeTruthy();
  return await res.json() as Array<{ jobid: number; jobname: string; schedule: string; active: boolean }>;
}

async function getCronRunDetails(request: any, jobName: string, limit = 5) {
  const res = await request.post(
    `${SUPABASE_URL}/rest/v1/rpc/get_cron_job_run_details`,
    { headers, data: { p_name: jobName, p_limit: limit } }
  );
  expect(res.ok(), `get_cron_job_run_details RPC failed for ${jobName}`).toBeTruthy();
  return await res.json() as Array<{
    runid: number; jobid: number; status: string; return_message: string; start_time: string; end_time: string;
  }>;
}

// ─── test suite ─────────────────────────────────────────────────────────────

test.describe('pg_cron health', () => {

  // ── Registration checks ────────────────────────────────────────────────────

  test.describe('cron jobs are registered', () => {
    const expectedJobs = [
      { name: 'self-heal',               schedule: '*/15 * * * *' },
      { name: 'automation-health-digest', schedule: '0 12 * * *'  },
      { name: 'midweek-oversight',        schedule: '0 15 * * 3'  },
      { name: 'sync-customer-emails',     schedule: '0 1 * * 1'   },
    ];

    for (const { name, schedule } of expectedJobs) {
      test(`${name} is registered with correct schedule`, async ({ request }) => {
        const rows = await getCronJob(request, name);
        expect(rows.length, `${name} not found in cron.job`).toBe(1);
        expect(rows[0].active, `${name} is not active`).toBe(true);
        expect(rows[0].schedule, `${name} has wrong schedule`).toBe(schedule);
      });
    }
  });

  // ── Execution checks ───────────────────────────────────────────────────────

  test('self-heal fired successfully within the last 20 minutes', async ({ request }) => {
    const runs = await getCronRunDetails(request, 'self-heal', 5);

    expect(
      runs.length,
      'self-heal has no cron execution history — pg_cron may not be reaching the function'
    ).toBeGreaterThan(0);

    const mostRecent = runs[0]; // ordered by start_time DESC
    const minutesAgo = (Date.now() - new Date(mostRecent.start_time).getTime()) / (1000 * 60);

    expect(
      minutesAgo,
      `self-heal last fired ${Math.round(minutesAgo)} minutes ago (expected ≤20). ` +
      `Last status: ${mostRecent.status}. ` +
      `Message: ${mostRecent.return_message}`
    ).toBeLessThan(20);

    expect(
      mostRecent.status,
      `Most recent self-heal cron run has status "${mostRecent.status}" not "succeeded". ` +
      `Error: ${mostRecent.return_message}`
    ).toBe('succeeded');
  });

  test('self-heal has no silent failure loop (last 5 runs not all failed)', async ({ request }) => {
    const runs = await getCronRunDetails(request, 'self-heal', 5);
    if (runs.length === 0) return; // no history at all — caught by previous test

    const allFailed = runs.every(r => r.status === 'failed');
    const failMessages = runs
      .filter(r => r.status === 'failed')
      .map(r => r.return_message)
      .filter((v, i, a) => a.indexOf(v) === i) // unique messages
      .join(' | ');

    expect(
      allFailed,
      `All last ${runs.length} self-heal cron runs have status "failed". ` +
      `Recurring error: ${failMessages}`
    ).toBe(false);
  });

  test('scheduled automations ran within their expected window (via schedule_config)', async ({ request }) => {
    // Map each tracked function to its MAX expected gap. Functions triggered
    // by self-heal, health-digest, or pg_cron all update schedule_config.last_run_at,
    // so it's the source of truth for freshness regardless of trigger source.
    //
    // IMPORTANT: sync-customer-emails runs weekly (Monday 1 AM) per its cron
    // schedule `0 1 * * 1`, not daily. The previous version of this test
    // treated it as daily and failed every day except Monday, causing the
    // automation health CI to fail 6 out of every 7 days.
    const trackedFunctions: Array<{ name: string; maxHours: number; cadence: string }> = [
      { name: 'automation-health-digest', maxHours: 25,  cadence: 'daily 12 PM UTC' },
      { name: 'sync-customer-emails',     maxHours: 169, cadence: 'weekly Mon 1 AM UTC + 1h buffer' },
    ];

    const names = trackedFunctions.map(f => f.name).join(',');
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/schedule_config?function_name=in.(${names})&select=function_name,last_run_at,last_run_status`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        }
      }
    );
    expect(res.ok()).toBeTruthy();
    const rows = await res.json() as Array<{ function_name: string; last_run_at: string; last_run_status: string }>;

    for (const fn of trackedFunctions) {
      const row = rows.find(r => r.function_name === fn.name);
      expect(row, `${fn.name} not found in schedule_config`).toBeTruthy();
      if (!row) continue;

      const hoursAgo = (Date.now() - new Date(row.last_run_at).getTime()) / (1000 * 60 * 60);
      expect(
        hoursAgo,
        `${fn.name} last ran ${hoursAgo.toFixed(1)}h ago (expected ≤${fn.maxHours}h, cadence: ${fn.cadence}). Status: ${row.last_run_status}`
      ).toBeLessThan(fn.maxHours);
    }
  });

  // ── Advisory: verify pg_net is installed ──────────────────────────────────
  // A "schema net does not exist" failure message means pg_net is not installed.
  // This was the root cause of the 2026-04-13 outage.

  test('no cron runs are failing with "schema net does not exist"', async ({ request }) => {
    const jobs = ['self-heal', 'automation-health-digest', 'midweek-oversight', 'sync-customer-emails'];
    const pgNetErrors: string[] = [];

    for (const jobName of jobs) {
      const runs = await getCronRunDetails(request, jobName, 10);
      const netErrors = runs.filter(r =>
        r.status === 'failed' && r.return_message?.includes('schema "net" does not exist')
      );
      if (netErrors.length > 0) {
        pgNetErrors.push(`${jobName}: ${netErrors.length} run(s) with pg_net error`);
      }
    }

    expect(
      pgNetErrors.length,
      `pg_net extension missing — cron jobs failing: ${pgNetErrors.join(', ')}. ` +
      `Run: CREATE EXTENSION IF NOT EXISTS pg_net;`
    ).toBe(0);
  });

  test('no cron runs are failing with "unrecognized configuration parameter"', async ({ request }) => {
    const jobs = ['self-heal', 'automation-health-digest', 'midweek-oversight', 'sync-customer-emails'];
    const configErrors: string[] = [];

    for (const jobName of jobs) {
      const runs = await getCronRunDetails(request, jobName, 10);
      const cfgErrors = runs.filter(r =>
        r.status === 'failed' && r.return_message?.includes('unrecognized configuration parameter')
      );
      if (cfgErrors.length > 0) {
        configErrors.push(`${jobName}: ${cfgErrors.length} run(s) with current_setting() error`);
      }
    }

    expect(
      configErrors.length,
      `Cron job commands use current_setting() for a parameter that is not set: ` +
      `${configErrors.join(', ')}. Re-register jobs without current_setting() auth header.`
    ).toBe(0);
  });

});
