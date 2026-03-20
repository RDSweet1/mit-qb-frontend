/**
 * Send Counsel Report — API Tests
 *
 * Tests the send-counsel-report edge function which renders a clean
 * billing summary email and sends via Microsoft Graph API.
 */
import { test, expect } from '@playwright/test';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const fnHeaders = {
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

// Minimal valid report data for testing
const MOCK_REPORT_DATA = {
  customer: { name: 'Test Customer', id: '99999' },
  dateRange: { start: '2026-03-01', end: '2026-03-15' },
  invoices: [
    {
      Id: 'test-1',
      DocNumber: 'TEST-001',
      TxnDate: '2026-03-15',
      TotalAmt: 1500.00,
      Balance: 0,
      Lines: [
        { ItemName: 'Consulting', Rate: 350, Qty: 4, Amount: 1400, Description: '' },
        { ItemName: 'Administrative', Rate: 100, Qty: 1, Amount: 100, Description: '' },
      ],
    },
  ],
  timeEntries: [
    {
      TxnDate: '2026-03-10',
      EmployeeName: 'R. David Sweet',
      Hours: 4,
      Minutes: 0,
      StartTime: '2026-03-10T13:00:00Z',
      EndTime: '2026-03-10T17:00:00Z',
      ServiceItem: 'Consulting',
      BillableStatus: 'Billable',
      DurationMatch: true,
    },
  ],
  summary: {
    totalInvoiced: 1500.00,
    totalPaid: 1500.00,
    totalOutstanding: 0,
    invoiceCount: 1,
    totalHours: 4.0,
    entryCount: 1,
    entriesWithClockTimes: 1,
    entriesWithDurationMismatch: 0,
  },
};

test.describe('Send Counsel Report edge function', () => {
  test('function is deployed (not 404)', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/send-counsel-report`,
      {
        headers: fnHeaders,
        data: {},
      }
    );
    expect(res.status()).not.toBe(404);
  });

  test('rejects request without "to" recipients', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/send-counsel-report`,
      {
        headers: fnHeaders,
        data: {
          reportData: MOCK_REPORT_DATA,
          subject: 'Test',
        },
      }
    );
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('recipient');
  });

  test('rejects request without reportData', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/send-counsel-report`,
      {
        headers: fnHeaders,
        data: {
          to: ['david@mitigationconsulting.com'],
          subject: 'Test',
        },
      }
    );
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('reportData');
  });

  test('sends report successfully to test recipient', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/send-counsel-report`,
      {
        headers: fnHeaders,
        data: {
          to: ['david@mitigationconsulting.com'],
          cc: ['skisner@mitigationconsulting.com'],
          subject: 'API Test — Counsel Billing Report',
          reportData: MOCK_REPORT_DATA,
          sentBy: 'playwright-test',
        },
        timeout: 30000,
      }
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.recipientCount).toBe(2); // 1 to + 1 cc
  });

  test('handles multiple to recipients', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/send-counsel-report`,
      {
        headers: fnHeaders,
        data: {
          to: ['david@mitigationconsulting.com', 'skisner@mitigationconsulting.com'],
          subject: 'API Test — Multi-Recipient Counsel Report',
          reportData: MOCK_REPORT_DATA,
          sentBy: 'playwright-test',
        },
        timeout: 30000,
      }
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.recipientCount).toBe(2);
  });

  test('auto-generates subject when not provided', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/send-counsel-report`,
      {
        headers: fnHeaders,
        data: {
          to: ['david@mitigationconsulting.com'],
          reportData: MOCK_REPORT_DATA,
          sentBy: 'playwright-test',
        },
        timeout: 30000,
      }
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
