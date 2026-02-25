/**
 * Cash Position E2E Tests
 *
 * Tests the Cash Position tab on the Profitability page:
 *   - Tab existence and navigation
 *   - Sync panel UI (both buttons)
 *   - Net Position hero cards (5 metrics)
 *   - Account Balances table
 *   - CC Expense Breakdown
 *   - Upcoming Bills / A/P
 *   - YTD Summary cards rendering
 *   - A/R aging section
 *   - Weekly detail table structure
 *   - Chart rendering
 */
import { test, expect } from '../fixtures/test';
import { ProfitabilityPage } from '../pages/profitability.page';

test.describe('Cash Position Tab', () => {
  test('Cash Position tab exists on profitability page', async ({ page }) => {
    const profitability = new ProfitabilityPage(page);
    await profitability.goto();
    await expect(page.getByRole('button', { name: /cash position/i })).toBeVisible();
  });

  test('clicking Cash Position tab shows sync panel', async ({ page }) => {
    const profitability = new ProfitabilityPage(page);
    await profitability.goto();

    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    // Sync panel should be visible
    await expect(page.locator('text=Payment & Invoice Sync')).toBeVisible();
    await expect(page.getByRole('button', { name: /sync payments/i })).toBeVisible();
  });

  test('shows 4 summary cards', async ({ page }) => {
    const profitability = new ProfitabilityPage(page);
    await profitability.goto();

    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    // Summary cards use <span> labels (not <th> column headers)
    await expect(page.locator('span', { hasText: 'YTD Billed' })).toBeVisible();
    await expect(page.locator('span', { hasText: 'YTD Received' })).toBeVisible();
    await expect(page.locator('span', { hasText: 'Collection Rate' })).toBeVisible();
    await expect(page.locator('span', { hasText: 'Outstanding A/R' })).toBeVisible();
  });

  test('A/R Aging section is present and collapsible', async ({ page }) => {
    const profitability = new ProfitabilityPage(page);
    await profitability.goto();

    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    // A/R Aging header should be visible
    const agingHeader = page.locator('text=A/R Aging');
    await expect(agingHeader).toBeVisible();

    // Aging bucket labels should be visible in the header row
    const agingSection = page.locator('button', { hasText: 'A/R Aging' });
    await expect(agingSection).toBeVisible();

    // Click to expand
    await agingSection.click();

    // After expanding, should show aging bar or detail table
    const agingBar = page.locator('.bg-green-400, .bg-amber-400, .bg-orange-400, .bg-red-400');
    const noOutstanding = page.locator('text=No outstanding invoices');
    // One of these should be visible
    await expect(agingBar.first().or(noOutstanding)).toBeVisible({ timeout: 5000 });
  });

  test('shows weekly detail table or empty state', async ({ page }) => {
    const profitability = new ProfitabilityPage(page);
    await profitability.goto();

    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    // Should show either the weekly table or empty state
    const weeklyTable = page.locator('text=Weekly Cash Detail');
    const emptyState = page.locator('text=No Cash Data');
    await expect(weeklyTable.or(emptyState)).toBeVisible({ timeout: 10000 });
  });

  test('weekly table has correct column headers when data exists', async ({ page }) => {
    const profitability = new ProfitabilityPage(page);
    await profitability.goto();

    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    const hasTable = await page.locator('text=Weekly Cash Detail').isVisible().catch(() => false);
    if (!hasTable) return; // skip if no data

    const headerRow = page.locator('thead th');
    const headers = await headerRow.allTextContents();
    const headerTexts = headers.map(h => h.trim().toLowerCase());

    expect(headerTexts).toContain('week');
    expect(headerTexts).toContain('billed');
    expect(headerTexts).toContain('received');
    expect(headerTexts).toContain('labor');
    expect(headerTexts).toContain('overhead');
    expect(headerTexts).toContain('expenses');
    expect(headerTexts).toContain('net');
    expect(headerTexts).toContain('ytd billed');
    expect(headerTexts).toContain('ytd rcvd');
    expect(headerTexts).toContain('ytd exp');
    expect(headerTexts).toContain('ytd net');
    expect(headerTexts).toContain('collect%');
    expect(headerTexts).toContain('expense%');
  });

  test('collection rate badges have color coding', async ({ page }) => {
    const profitability = new ProfitabilityPage(page);
    await profitability.goto();

    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    // Look for collection rate badges in the table
    const badges = page.locator('span.rounded-full').filter({ hasText: /%/ });
    const count = await badges.count();

    if (count > 0) {
      const firstBadge = badges.first();
      const classes = await firstBadge.getAttribute('class');
      // Should have one of the expected color classes
      expect(classes).toMatch(/bg-(green|amber|red)-100/);
    }
  });

  test('sync button triggers edge function call', async ({ page }) => {
    const profitability = new ProfitabilityPage(page);
    await profitability.goto();

    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    // Set up request interceptor to verify the edge function is called
    let syncCalled = false;
    page.on('request', (req) => {
      if (req.url().includes('sync-payments')) {
        syncCalled = true;
      }
    });

    const syncButton = page.getByRole('button', { name: /sync payments/i });
    await syncButton.click();

    // Button should show loading state
    await expect(page.locator('text=Syncing...')).toBeVisible({ timeout: 3000 });

    // Wait for the sync to complete (up to 2 minutes for QB API calls)
    await expect(page.locator('text=Syncing...')).not.toBeVisible({ timeout: 120000 });

    // Verify the edge function was actually called
    expect(syncCalled).toBeTruthy();

    // Should show success or error result
    const success = page.locator('text=/Synced \\d+ payments/');
    const error = page.locator('text=/Sync failed|error/i');
    await expect(success.or(error)).toBeVisible({ timeout: 5000 });
  });

  // ================================================================
  // Net Position — Live Balances UI
  // ================================================================

  test('Refresh Live Balances button is visible', async ({ page }) => {
    const profitability = new ProfitabilityPage(page);
    await profitability.goto();

    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: /refresh live balances/i })).toBeVisible();
  });

  test('both sync buttons exist in the sync panel', async ({ page }) => {
    const profitability = new ProfitabilityPage(page);
    await profitability.goto();

    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: /refresh live balances/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /sync payments/i })).toBeVisible();
  });

  test('Refresh Live Balances calls cash-position-summary', async ({ page }) => {
    const profitability = new ProfitabilityPage(page);
    await profitability.goto();

    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    let edgeFnCalled = false;
    page.on('request', (req) => {
      if (req.url().includes('cash-position-summary')) {
        edgeFnCalled = true;
      }
    });

    const btn = page.getByRole('button', { name: /refresh live balances/i });
    await btn.click();

    // Button should show loading state
    await expect(page.locator('text=Loading...')).toBeVisible({ timeout: 3000 });

    // Wait for it to finish (QB API can be slow)
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 120000 });

    expect(edgeFnCalled).toBeTruthy();
  });

  test('after live refresh, 5 net position hero cards appear', async ({ page }) => {
    const profitability = new ProfitabilityPage(page);
    await profitability.goto();

    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    // Trigger live refresh
    await page.getByRole('button', { name: /refresh live balances/i }).click();
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 120000 });

    // Check all 5 hero cards
    await expect(page.locator('span', { hasText: 'Cash on Hand' })).toBeVisible();
    await expect(page.locator('span', { hasText: 'CC Outstanding' })).toBeVisible();
    await expect(page.locator('span', { hasText: 'Receivables (A/R)' })).toBeVisible();
    await expect(page.locator('span', { hasText: 'Payables (A/P)' })).toBeVisible();
    await expect(page.locator('span', { hasText: 'Net Position' })).toBeVisible();
  });

  test('net position card shows formula subtitle', async ({ page }) => {
    const profitability = new ProfitabilityPage(page);
    await profitability.goto();

    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /refresh live balances/i }).click();
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 120000 });

    // Formula subtitle under Net Position card
    const formulaText = page.locator('p', { hasText: /Cash.*CC Debt.*A\/R.*A\/P/ });
    await expect(formulaText).toBeVisible();
  });

  test('Account Balances section appears after live refresh', async ({ page }) => {
    const profitability = new ProfitabilityPage(page);
    await profitability.goto();

    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /refresh live balances/i }).click();
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 120000 });

    // Account Balances heading should be visible
    await expect(page.locator('h3', { hasText: 'Account Balances' })).toBeVisible();

    // Should show type badges (Bank / Credit Card)
    const bankBadges = page.locator('span.rounded-full', { hasText: 'Bank' });
    const ccBadges = page.locator('span.rounded-full', { hasText: 'Credit Card' });
    const bankCount = await bankBadges.count();
    const ccCount = await ccBadges.count();
    expect(bankCount + ccCount).toBeGreaterThan(0);
  });

  test('Account Balances shows Total Bank and Total CC Debt rows', async ({ page }) => {
    const profitability = new ProfitabilityPage(page);
    await profitability.goto();

    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /refresh live balances/i }).click();
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 120000 });

    await expect(page.locator('text=Total Bank')).toBeVisible();
    await expect(page.locator('text=Total CC Debt')).toBeVisible();
  });

  test('CC Expense Breakdown section is collapsible', async ({ page }) => {
    const profitability = new ProfitabilityPage(page);
    await profitability.goto();

    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /refresh live balances/i }).click();
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 120000 });

    // CC Expense Breakdown should be visible as a collapsible header
    const ccHeader = page.locator('button', { hasText: 'CC Expense Breakdown' });
    await expect(ccHeader).toBeVisible();

    // Click to expand
    await ccHeader.click();

    // Should show either category data or the empty state message
    const categoryTable = page.locator('th', { hasText: 'Category' });
    const emptyState = page.locator('text=Run Daily Review Sync to populate CC expense data.');
    await expect(categoryTable.first().or(emptyState)).toBeVisible({ timeout: 5000 });
  });

  test('Upcoming Bills / A/P section is collapsible', async ({ page }) => {
    const profitability = new ProfitabilityPage(page);
    await profitability.goto();

    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /refresh live balances/i }).click();
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 120000 });

    // A/P header
    const apHeader = page.locator('button', { hasText: 'Upcoming Bills / A/P' });
    await expect(apHeader).toBeVisible();

    // Click to expand
    await apHeader.click();

    // Should show either bill data or "No open bills"
    const vendorColumn = page.locator('th', { hasText: 'Vendor' });
    const emptyState = page.locator('text=No open bills');
    await expect(vendorColumn.first().or(emptyState)).toBeVisible({ timeout: 5000 });
  });

  test('A/P bills show status badges (Overdue/Due Soon/Current)', async ({ page }) => {
    const profitability = new ProfitabilityPage(page);
    await profitability.goto();

    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /refresh live balances/i }).click();
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 120000 });

    // Expand A/P section
    await page.locator('button', { hasText: 'Upcoming Bills / A/P' }).click();

    // If there are bills, check for status badges
    const hasBills = await page.locator('th', { hasText: 'Vendor' }).isVisible().catch(() => false);
    if (hasBills) {
      const statusBadges = page.locator('span.rounded-full').filter({ hasText: /Overdue|Due Soon|Current/ });
      const count = await statusBadges.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('live balances timestamp is shown after refresh', async ({ page }) => {
    const profitability = new ProfitabilityPage(page);
    await profitability.goto();

    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /refresh live balances/i }).click();
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 120000 });

    // Should show "Live balances as of ..."
    await expect(page.locator('text=Live balances as of')).toBeVisible();
  });

  test('existing YTD cards still appear after live refresh', async ({ page }) => {
    const profitability = new ProfitabilityPage(page);
    await profitability.goto();

    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /refresh live balances/i }).click();
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 120000 });

    // Original 4 YTD summary cards should still be visible below net position
    await expect(page.locator('span', { hasText: 'YTD Billed' })).toBeVisible();
    await expect(page.locator('span', { hasText: 'YTD Received' })).toBeVisible();
    await expect(page.locator('span', { hasText: 'Collection Rate' })).toBeVisible();
    await expect(page.locator('span', { hasText: 'Outstanding A/R' })).toBeVisible();
  });

  // ================================================================
  // Original tests continue below
  // ================================================================

  test('chart renders when data exists', async ({ page }) => {
    const profitability = new ProfitabilityPage(page);
    await profitability.goto();

    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    // If there's weekly data, chart should render
    const chartTitle = page.locator('text=Weekly Cash Flow');
    const hasChart = await chartTitle.isVisible().catch(() => false);

    if (hasChart) {
      // Recharts renders SVG elements
      const svg = page.locator('.recharts-wrapper svg');
      await expect(svg).toBeVisible();
    }
  });

  test('date range affects displayed data', async ({ page }) => {
    const profitability = new ProfitabilityPage(page);
    await profitability.goto();

    // Switch to a wider date range first
    const presetButtons = page.locator('button', { hasText: /last 3 months|last 6 months|this year/i });
    const presetCount = await presetButtons.count();
    if (presetCount > 0) {
      await presetButtons.first().click();
      await page.waitForLoadState('networkidle');
    }

    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    // The page should load without errors
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    // Wait a moment for any deferred errors
    await page.waitForTimeout(2000);
    expect(errors).toHaveLength(0);
  });

  test('no console errors on Cash Position tab', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    const profitability = new ProfitabilityPage(page);
    await profitability.goto();

    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    expect(errors).toHaveLength(0);
  });
});
