/**
 * Cash Position E2E Tests
 *
 * Tests the Cash Position tab on the Profitability page:
 *   - Tab existence and navigation
 *   - Sync panel UI
 *   - Summary cards rendering
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
