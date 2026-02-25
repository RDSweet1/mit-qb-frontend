/**
 * Cash Position Summary — API Tests
 *
 * Tests the cash-position-summary edge function:
 *   1. Deployment & CORS
 *   2. Response schema validation
 *   3. Totals math verification (net position formula)
 *   4. Cross-validation against individual Supabase tables
 *   5. Account type filtering (only Bank + Credit Card)
 *   6. CC expense breakdown only counts Purchases (no double-counting)
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
// 1. Deployment & CORS
// ==================================================================

test.describe('cash-position-summary deployment', () => {
  test('responds to OPTIONS (deployed)', async ({ request }) => {
    const res = await request.fetch(
      `${SUPABASE_URL}/functions/v1/cash-position-summary`,
      { method: 'OPTIONS', headers: fnHeaders }
    );
    expect(res.status()).toBe(200);
  });

  test('returns CORS headers', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/cash-position-summary`,
      { headers: fnHeaders, data: {} }
    );
    const headers = res.headers();
    expect(headers['access-control-allow-origin']).toBe('*');
  });
});

// ==================================================================
// 2. Response Schema Validation
// ==================================================================

test.describe('cash-position-summary response schema', () => {
  let response: any;

  test.beforeAll(async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/cash-position-summary`,
      { headers: fnHeaders, data: {}, timeout: 60000 }
    );
    expect(res.ok()).toBeTruthy();
    response = await res.json();
  });

  test('returns success: true', () => {
    expect(response.success).toBe(true);
  });

  test('has accounts array', () => {
    expect(Array.isArray(response.accounts)).toBeTruthy();
  });

  test('has openBills array', () => {
    expect(Array.isArray(response.openBills)).toBeTruthy();
  });

  test('has ccExpenseBreakdown array', () => {
    expect(Array.isArray(response.ccExpenseBreakdown)).toBeTruthy();
  });

  test('has totals object with all required fields', () => {
    expect(response.totals).toBeDefined();
    expect(typeof response.totals.totalCash).toBe('number');
    expect(typeof response.totals.totalCCDebt).toBe('number');
    expect(typeof response.totals.totalAR).toBe('number');
    expect(typeof response.totals.totalAP).toBe('number');
    expect(typeof response.totals.netPosition).toBe('number');
    expect(typeof response.totals.arCount).toBe('number');
    expect(typeof response.totals.apCount).toBe('number');
  });

  test('has fetchedAt ISO timestamp', () => {
    expect(response.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('accounts have required fields', () => {
    for (const acct of response.accounts) {
      expect(acct.id).toBeTruthy();
      expect(acct.name).toBeTruthy();
      expect(['Bank', 'Credit Card']).toContain(acct.accountType);
      expect(typeof acct.currentBalance).toBe('number');
      expect(typeof acct.active).toBe('boolean');
    }
  });

  test('openBills have required fields', () => {
    for (const bill of response.openBills) {
      expect(bill.id).toBeTruthy();
      expect(bill.vendorName).toBeTruthy();
      expect(bill.txnDate).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(typeof bill.totalAmount).toBe('number');
      expect(typeof bill.balance).toBe('number');
      expect(typeof bill.isOverdue).toBe('boolean');
      // balance > 0 (open bills only)
      expect(bill.balance).toBeGreaterThan(0);
    }
  });

  test('ccExpenseBreakdown items have required fields', () => {
    for (const item of response.ccExpenseBreakdown) {
      expect(item.accountName).toBeTruthy();
      expect(item.category).toBeTruthy();
      expect(typeof item.totalAmount).toBe('number');
      expect(typeof item.transactionCount).toBe('number');
      expect(item.transactionCount).toBeGreaterThan(0);
    }
  });
});

// ==================================================================
// 3. Totals Math Verification
// ==================================================================

test.describe('cash-position-summary totals math', () => {
  let response: any;

  test.beforeAll(async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/cash-position-summary`,
      { headers: fnHeaders, data: {}, timeout: 60000 }
    );
    response = await res.json();
  });

  test('totalCash = sum of Bank account balances', () => {
    const bankAccounts = response.accounts.filter((a: any) => a.accountType === 'Bank');
    const expectedCash = bankAccounts.reduce((s: number, a: any) => s + a.currentBalance, 0);
    expect(response.totals.totalCash).toBeCloseTo(expectedCash, 2);
  });

  test('totalCCDebt = sum of Credit Card account balances', () => {
    const ccAccounts = response.accounts.filter((a: any) => a.accountType === 'Credit Card');
    const expectedCC = ccAccounts.reduce((s: number, a: any) => s + a.currentBalance, 0);
    expect(response.totals.totalCCDebt).toBeCloseTo(expectedCC, 2);
  });

  test('totalAP = sum of open bill balances', () => {
    const expectedAP = response.openBills.reduce((s: number, b: any) => s + b.balance, 0);
    expect(response.totals.totalAP).toBeCloseTo(expectedAP, 2);
  });

  test('apCount = number of open bills', () => {
    expect(response.totals.apCount).toBe(response.openBills.length);
  });

  test('netPosition = Cash - CCDebt + AR - AP', () => {
    const { totalCash, totalCCDebt, totalAR, totalAP, netPosition } = response.totals;
    const expected = totalCash - totalCCDebt + totalAR - totalAP;
    expect(netPosition).toBeCloseTo(expected, 2);
  });

  test('totalCash is non-negative (sanity check)', () => {
    expect(response.totals.totalCash).toBeGreaterThanOrEqual(0);
  });

  test('totalCCDebt is non-negative (QB uses positive for owed)', () => {
    expect(response.totals.totalCCDebt).toBeGreaterThanOrEqual(0);
  });

  test('totalAR is non-negative', () => {
    expect(response.totals.totalAR).toBeGreaterThanOrEqual(0);
  });

  test('totalAP is non-negative', () => {
    expect(response.totals.totalAP).toBeGreaterThanOrEqual(0);
  });
});

// ==================================================================
// 4. Cross-Validation Against Supabase Tables
// ==================================================================

test.describe('cross-validation with Supabase tables', () => {
  let summaryTotals: any;

  test.beforeAll(async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/cash-position-summary`,
      { headers: fnHeaders, data: {}, timeout: 60000 }
    );
    const body = await res.json();
    summaryTotals = body.totals;
  });

  test('A/R total matches qb_invoice_balances sum', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/qb_invoice_balances?select=balance&balance=gt.0`,
      { headers: restHeaders }
    );
    const data = await res.json();
    const dbTotal = data.reduce((s: number, r: any) => s + Number(r.balance), 0);

    // Should match within a small tolerance (rounding)
    expect(summaryTotals.totalAR).toBeCloseTo(dbTotal, 0);
  });

  test('A/R count matches qb_invoice_balances row count', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/qb_invoice_balances?select=id&balance=gt.0`,
      { headers: restHeaders }
    );
    const data = await res.json();
    expect(summaryTotals.arCount).toBe(data.length);
  });
});

// ==================================================================
// 5. Account Type Filtering
// ==================================================================

test.describe('account type filtering', () => {
  test('only returns Bank and Credit Card accounts', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/cash-position-summary`,
      { headers: fnHeaders, data: {}, timeout: 60000 }
    );
    const body = await res.json();

    for (const acct of body.accounts) {
      expect(['Bank', 'Credit Card']).toContain(acct.accountType);
    }

    // Should not contain Expense, Income, Accounts Receivable, etc.
    const otherTypes = body.accounts.filter(
      (a: any) => a.accountType !== 'Bank' && a.accountType !== 'Credit Card'
    );
    expect(otherTypes).toHaveLength(0);
  });

  test('all returned accounts are active', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/cash-position-summary`,
      { headers: fnHeaders, data: {}, timeout: 60000 }
    );
    const body = await res.json();

    for (const acct of body.accounts) {
      expect(acct.active).toBe(true);
    }
  });

  test('accounts are sorted: Bank first, then Credit Card', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/cash-position-summary`,
      { headers: fnHeaders, data: {}, timeout: 60000 }
    );
    const body = await res.json();

    if (body.accounts.length > 1) {
      let seenCC = false;
      for (const acct of body.accounts) {
        if (acct.accountType === 'Credit Card') seenCC = true;
        if (acct.accountType === 'Bank' && seenCC) {
          // Bank should not appear after Credit Card
          throw new Error('Bank account found after Credit Card — sort order wrong');
        }
      }
    }
  });
});

// ==================================================================
// 6. CC Expense — No Double-Counting
// ==================================================================

test.describe('CC expense double-counting prevention', () => {
  test('CC breakdown only counts Purchase transactions', async ({ request }) => {
    // Get all CC transactions from daily_review_transactions
    const allRes = await request.get(
      `${SUPABASE_URL}/rest/v1/daily_review_transactions?select=qb_entity_type,total_amount&limit=500`,
      { headers: restHeaders }
    );
    const allTxns = await allRes.json();

    // If there are Transfer or BillPayment types, they should NOT be in the breakdown
    const transfers = allTxns.filter((t: any) => t.qb_entity_type === 'Transfer');
    const billPayments = allTxns.filter((t: any) => t.qb_entity_type === 'BillPayment');

    // Get the summary
    const summaryRes = await request.post(
      `${SUPABASE_URL}/functions/v1/cash-position-summary`,
      { headers: fnHeaders, data: {}, timeout: 60000 }
    );
    const summary = await summaryRes.json();

    // Total from breakdown
    const breakdownTotal = summary.ccExpenseBreakdown.reduce(
      (s: number, i: any) => s + i.totalAmount, 0
    );

    // If there are transfers, the breakdown total should be less than all txns total
    if (transfers.length > 0 || billPayments.length > 0) {
      const allTotal = allTxns.reduce((s: number, t: any) => s + Number(t.total_amount), 0);
      // Breakdown should not exceed purchase-only total
      const purchaseOnly = allTxns
        .filter((t: any) => t.qb_entity_type === 'Purchase')
        .reduce((s: number, t: any) => s + Number(t.total_amount), 0);

      expect(breakdownTotal).toBeCloseTo(purchaseOnly, 0);
    }

    console.log(`CC breakdown: ${summary.ccExpenseBreakdown.length} categories, total ${breakdownTotal.toFixed(2)}`);
  });
});

// ==================================================================
// 7. Idempotency — Multiple Calls Return Consistent Data
// ==================================================================

test.describe('idempotency', () => {
  test('two consecutive calls return same totals', async ({ request }) => {
    const [res1, res2] = await Promise.all([
      request.post(`${SUPABASE_URL}/functions/v1/cash-position-summary`, {
        headers: fnHeaders, data: {}, timeout: 60000,
      }),
      request.post(`${SUPABASE_URL}/functions/v1/cash-position-summary`, {
        headers: fnHeaders, data: {}, timeout: 60000,
      }),
    ]);

    const body1 = await res1.json();
    const body2 = await res2.json();

    // Totals should be identical (same QB snapshot)
    expect(body1.totals.totalCash).toBeCloseTo(body2.totals.totalCash, 2);
    expect(body1.totals.totalCCDebt).toBeCloseTo(body2.totals.totalCCDebt, 2);
    expect(body1.totals.totalAR).toBe(body2.totals.totalAR);
    expect(body1.totals.totalAP).toBeCloseTo(body2.totals.totalAP, 2);
    expect(body1.totals.netPosition).toBeCloseTo(body2.totals.netPosition, 0);

    // Same number of accounts
    expect(body1.accounts.length).toBe(body2.accounts.length);
  });
});
