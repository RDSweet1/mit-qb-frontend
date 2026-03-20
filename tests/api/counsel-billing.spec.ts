/**
 * Counsel Billing Summary — API Tests
 *
 * Tests the counsel-billing-summary edge function which pulls
 * invoices from QB Online + time entries from Supabase to generate
 * a comprehensive billing report for opposing counsel.
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
};

test.describe('Counsel Billing Summary edge function', () => {
  test('rejects request without customerId', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/counsel-billing-summary`,
      {
        headers: fnHeaders,
        data: { startDate: '2026-01-01', endDate: '2026-03-17' },
      }
    );
    expect(res.status()).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('customerId');
  });

  test('returns data for a valid customer with numeric ID', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/counsel-billing-summary`,
      {
        headers: fnHeaders,
        data: {
          customerId: '341',
          startDate: '2026-03-01',
          endDate: '2026-03-17',
        },
        timeout: 60000,
      }
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.customer).toBeDefined();
    expect(body.customer.id).toBe('341');
    expect(body.dateRange.start).toBe('2026-03-01');
    expect(body.dateRange.end).toBe('2026-03-17');
    expect(Array.isArray(body.invoices)).toBe(true);
    expect(Array.isArray(body.timeEntries)).toBe(true);
    expect(body.summary).toBeDefined();
    expect(typeof body.summary.totalInvoiced).toBe('number');
    expect(typeof body.summary.totalHours).toBe('number');
    expect(typeof body.summary.entryCount).toBe('number');
    expect(typeof body.summary.entriesWithClockTimes).toBe('number');
    expect(typeof body.summary.entriesWithDurationMismatch).toBe('number');
  });

  test('returns data for a valid customer with display name ID', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/counsel-billing-summary`,
      {
        headers: fnHeaders,
        data: {
          customerId: 'AccessResto.Tarflower.VedderPrice',
          startDate: '2026-03-01',
          endDate: '2026-03-17',
        },
        timeout: 60000,
      }
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    // Should resolve to numeric ID 341
    expect(body.customer.id).toBe('341');
    expect(body.timeEntries.length).toBeGreaterThan(0);
  });

  test('returns invoices for full engagement date range', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/counsel-billing-summary`,
      {
        headers: fnHeaders,
        data: {
          customerId: '341',
          startDate: '2024-01-01',
          endDate: '2026-03-17',
        },
        timeout: 120000,
      }
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    // Should have invoices going back to 2024
    expect(body.invoices.length).toBeGreaterThanOrEqual(10);
    expect(body.summary.totalInvoiced).toBeGreaterThan(50000);
  });

  test('invoice data has correct structure', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/counsel-billing-summary`,
      {
        headers: fnHeaders,
        data: {
          customerId: '341',
          startDate: '2024-06-01',
          endDate: '2024-07-31',
        },
        timeout: 60000,
      }
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.invoices.length).toBeGreaterThan(0);

    const inv = body.invoices[0];
    expect(inv.Id).toBeDefined();
    expect(inv.DocNumber).toBeDefined();
    expect(inv.TxnDate).toBeDefined();
    expect(typeof inv.TotalAmt).toBe('number');
    expect(typeof inv.Balance).toBe('number');
    expect(Array.isArray(inv.Lines)).toBe(true);

    if (inv.Lines.length > 0) {
      const line = inv.Lines[0];
      expect(typeof line.Amount).toBe('number');
      expect(typeof line.Rate).toBe('number');
      expect(typeof line.Qty).toBe('number');
      expect(line.ItemName).toBeDefined();
      // Description should be stripped (empty) for counsel report
      expect(line.Description).toBe('');
    }
  });

  test('time entries have correct structure', async ({ request }) => {
    // Use full range to get entries from Supabase (has richer data)
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/counsel-billing-summary`,
      {
        headers: fnHeaders,
        data: {
          customerId: '341',
          startDate: '2025-12-01',
          endDate: '2026-03-17',
        },
        timeout: 60000,
      }
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.timeEntries.length).toBeGreaterThan(0);

    const entry = body.timeEntries[0];
    expect(entry.TxnDate).toBeDefined();
    expect(entry.EmployeeName).toBeDefined();
    expect(typeof entry.Hours).toBe('number');
    expect(typeof entry.Minutes).toBe('number');
    expect(entry.ServiceItem).toBeDefined();
    expect(entry.BillableStatus).toBeDefined();
    // DurationMatch should be boolean or null
    expect([true, false, null]).toContain(entry.DurationMatch);
  });

  test('time entries with clock times have valid duration check', async ({ request }) => {
    // Use Dec 2025+ range where Supabase entries have Workforce clock times
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/counsel-billing-summary`,
      {
        headers: fnHeaders,
        data: {
          customerId: '341',
          startDate: '2025-12-01',
          endDate: '2026-03-17',
        },
        timeout: 60000,
      }
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();

    const withClock = body.timeEntries.filter((e: any) => e.StartTime && e.EndTime);
    expect(withClock.length).toBeGreaterThan(0);
    expect(body.summary.entriesWithClockTimes).toBe(withClock.length);

    // Verify duration match logic
    for (const e of withClock) {
      const startMs = new Date(e.StartTime).getTime();
      const endMs = new Date(e.EndTime).getTime();
      const clockHrs = (endMs - startMs) / (1000 * 60 * 60);
      const recordedHrs = e.Hours + e.Minutes / 60;
      const diff = Math.abs(clockHrs - recordedHrs);

      if (e.DurationMatch === true) {
        expect(diff).toBeLessThan(0.09); // 5 min tolerance
      }
      if (e.DurationMatch === false) {
        expect(diff).toBeGreaterThanOrEqual(0.09);
      }
    }
  });

  test('returns empty results for customer with no data', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/counsel-billing-summary`,
      {
        headers: fnHeaders,
        data: {
          customerId: '99999',
          startDate: '2026-03-01',
          endDate: '2026-03-17',
        },
        timeout: 60000,
      }
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.invoices.length).toBe(0);
    expect(body.summary.totalInvoiced).toBe(0);
    expect(body.summary.totalHours).toBe(0);
  });

  test('summary math is consistent', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/counsel-billing-summary`,
      {
        headers: fnHeaders,
        data: {
          customerId: '341',
          startDate: '2024-01-01',
          endDate: '2026-03-17',
        },
        timeout: 120000,
      }
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();

    // totalPaid + totalOutstanding = totalInvoiced
    const calcPaid = body.summary.totalInvoiced - body.summary.totalOutstanding;
    expect(Math.abs(calcPaid - body.summary.totalPaid)).toBeLessThan(0.01);

    // entryCount matches timeEntries array length
    expect(body.summary.entryCount).toBe(body.timeEntries.length);

    // invoiceCount matches invoices array length
    expect(body.summary.invoiceCount).toBe(body.invoices.length);

    // totalHours matches sum of individual entries
    const calcHours = body.timeEntries.reduce(
      (s: number, e: any) => s + e.Hours + e.Minutes / 60, 0
    );
    expect(Math.abs(body.summary.totalHours - Math.round(calcHours * 100) / 100)).toBeLessThan(0.02);
  });
});

test.describe('Counsel Billing — health check', () => {
  test('counsel-billing-summary function is deployed', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/counsel-billing-summary`,
      {
        headers: fnHeaders,
        data: {},
      }
    );
    // Should return 500 (missing customerId), NOT 404 (not deployed)
    expect(res.status()).not.toBe(404);
  });

  test('send-counsel-report function is deployed', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/send-counsel-report`,
      {
        headers: fnHeaders,
        data: {},
      }
    );
    // Should return 400 (missing recipients), NOT 404 (not deployed)
    expect(res.status()).not.toBe(404);
  });

  test('customers table has Tarflower entry', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/customers?display_name=ilike.*tarflower*&select=display_name,qb_customer_id`,
      { headers: restHeaders }
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.length).toBeGreaterThan(0);
    expect(body.some((c: any) => c.display_name.includes('Tarflower'))).toBe(true);
  });
});
