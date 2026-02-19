/**
 * QB Health — Live Connectivity & Staleness Tests
 *
 * Calls the qb-health edge function which probes:
 *   1. QB Online API (CompanyInfo query)
 *   2. QB Time / Workforce API (current_user)
 *   3. Token freshness (qb_tokens.updated_at)
 *   4. Supabase write health (insert + delete)
 *   5. Sync staleness across all data tables
 *
 * These tests verify actual connectivity, not just deployment.
 */
import { test, expect } from '@playwright/test';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const fnHeaders = {
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

// Cache the health response across tests to avoid hammering the APIs
let cachedHealth: any = null;

async function getHealthReport(request: any): Promise<any> {
  if (cachedHealth) return cachedHealth;

  const res = await request.post(
    `${SUPABASE_URL}/functions/v1/qb-health`,
    { headers: fnHeaders, timeout: 30000 }
  );

  // Accept both 200 (healthy/degraded) and 503 (unhealthy) — we test probes individually
  expect([200, 503]).toContain(res.status());
  cachedHealth = await res.json();
  return cachedHealth;
}

// ==================================================================
// Edge function deployment
// ==================================================================

test.describe('qb-health deployment', () => {
  test('qb-health responds to OPTIONS (deployed)', async ({ request }) => {
    const res = await request.fetch(
      `${SUPABASE_URL}/functions/v1/qb-health`,
      { method: 'OPTIONS', headers: fnHeaders }
    );
    expect(res.status()).toBe(200);
  });

  test('qb-health returns structured health report', async ({ request }) => {
    const health = await getHealthReport(request);

    expect(health.status).toBeDefined();
    expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
    expect(health.timestamp).toBeTruthy();
    expect(health.probes).toBeDefined();
    expect(health.probes.qb_online).toBeDefined();
    expect(health.probes.qb_time).toBeDefined();
    expect(health.probes.token_freshness).toBeDefined();
    expect(health.probes.supabase_write).toBeDefined();
    expect(health.probes.sync_staleness).toBeDefined();
  });
});

// ==================================================================
// QB Online API Connectivity
// ==================================================================

test.describe('QB Online API connectivity', () => {
  test('QB Online API is reachable and authenticated', async ({ request }) => {
    const health = await getHealthReport(request);
    const probe = health.probes.qb_online;

    expect(probe.status).toBe('pass');
    expect(probe.message).toContain('Connected to');
    expect(probe.latencyMs).toBeDefined();
    expect(probe.latencyMs).toBeLessThan(10000); // under 10s

    console.log(`QB Online: ${probe.message} (${probe.latencyMs}ms)`);
  });

  test('QB Online connected to correct company', async ({ request }) => {
    const health = await getHealthReport(request);
    const probe = health.probes.qb_online;

    if (probe.status === 'pass' && probe.detail) {
      // Realm ID should be the production MIT company
      expect(probe.detail.realmId).toBe('9341455753458595');
      console.log(`QB Online company: ${probe.detail.companyName}`);
    }
  });
});

// ==================================================================
// QB Time / Workforce API Connectivity
// ==================================================================

test.describe('QB Time / Workforce API connectivity', () => {
  test('Workforce API is reachable and authenticated', async ({ request }) => {
    const health = await getHealthReport(request);
    const probe = health.probes.qb_time;

    expect(probe.status).toBe('pass');
    expect(probe.latencyMs).toBeDefined();
    expect(probe.latencyMs).toBeLessThan(10000);

    console.log(`QB Time: ${probe.message} (${probe.latencyMs}ms)`);
  });
});

// ==================================================================
// Token Freshness
// ==================================================================

test.describe('QB token freshness', () => {
  test('QB Online token is not expired or critically stale', async ({ request }) => {
    const health = await getHealthReport(request);
    const probe = health.probes.token_freshness;

    // Should be pass or warn — fail means refresh token may be expired
    expect(['pass', 'warn']).toContain(probe.status);

    if (probe.detail) {
      console.log(`Token age: ${probe.detail.ageDays} days (updated: ${probe.detail.updatedAt})`);

      // Warn if token is getting old (over 60 days)
      if (probe.detail.ageDays > 60) {
        console.warn(`WARNING: QB token is ${probe.detail.ageDays} days old — refresh before 101 day expiry!`);
      }
    }
  });

  test('token record exists in database', async ({ request }) => {
    const health = await getHealthReport(request);
    const probe = health.probes.token_freshness;

    // Should never fail with "No QB token record found"
    expect(probe.message).not.toContain('No QB token record found');
  });
});

// ==================================================================
// Supabase Write Health
// ==================================================================

test.describe('Supabase write health', () => {
  test('Supabase can insert and delete rows', async ({ request }) => {
    const health = await getHealthReport(request);
    const probe = health.probes.supabase_write;

    expect(probe.status).toBe('pass');
    expect(probe.message).toContain('healthy');
    expect(probe.latencyMs).toBeDefined();
    expect(probe.latencyMs).toBeLessThan(5000); // write should be fast

    console.log(`Supabase write: ${probe.message} (${probe.latencyMs}ms)`);
  });
});

// ==================================================================
// Sync Staleness
// ==================================================================

test.describe('Sync staleness', () => {
  test('sync staleness probe returns table details', async ({ request }) => {
    const health = await getHealthReport(request);
    const probe = health.probes.sync_staleness;

    expect(['pass', 'warn']).toContain(probe.status);
    expect(probe.detail).toBeDefined();

    // Should have entries for each tracked table
    const tables = Object.keys(probe.detail || {});
    expect(tables.length).toBeGreaterThanOrEqual(3);

    console.log('Sync staleness:', JSON.stringify(probe.detail, null, 2));
  });

  test('QB Payments table has been synced', async ({ request }) => {
    const health = await getHealthReport(request);
    const detail = health.probes.sync_staleness.detail || {};
    const payments = detail['QB Payments'];

    if (payments && payments.lastSynced) {
      // Should have been synced recently (from our earlier sync-payments tests)
      expect(payments.ageHours).toBeDefined();
      console.log(`QB Payments: last synced ${payments.ageHours}h ago`);
    }
  });

  test('Invoice Balances table has been synced', async ({ request }) => {
    const health = await getHealthReport(request);
    const detail = health.probes.sync_staleness.detail || {};
    const invoices = detail['Invoice Balances'];

    if (invoices && invoices.lastSynced) {
      expect(invoices.ageHours).toBeDefined();
      console.log(`Invoice Balances: last synced ${invoices.ageHours}h ago`);
    }
  });
});

// ==================================================================
// Overall Status
// ==================================================================

test.describe('Overall health status', () => {
  test('overall system is healthy or degraded (not unhealthy)', async ({ request }) => {
    const health = await getHealthReport(request);

    // Log full report for visibility
    console.log(`\n=== QB Health Report ===`);
    console.log(`Status: ${health.status.toUpperCase()}`);
    console.log(`Timestamp: ${health.timestamp}`);
    for (const [name, probe] of Object.entries(health.probes)) {
      const p = probe as any;
      const latency = p.latencyMs ? ` (${p.latencyMs}ms)` : '';
      console.log(`  ${p.status === 'pass' ? 'PASS' : p.status === 'warn' ? 'WARN' : 'FAIL'} ${name}: ${p.message}${latency}`);
    }
    console.log(`========================\n`);

    // System should be healthy or at most degraded
    expect(['healthy', 'degraded']).toContain(health.status);
  });
});
