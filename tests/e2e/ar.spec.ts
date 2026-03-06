/**
 * Accounts Receivable Page — E2E Tests
 *
 * Covers: page load, 4 sub-tabs, sync buttons, invoice list, queue,
 * activity log, detail drawer, and AR nav badge.
 */
import { test, expect } from '../fixtures/test';
import { ARPage } from '../pages/ar.page';
import { BasePage } from '../fixtures/base-page';

test.describe('Accounts Receivable', () => {
  // ------------------------------------------------------------------
  // Basic load
  // ------------------------------------------------------------------

  test('loads with correct page header', async ({ page }) => {
    const ar = new ARPage(page);
    await ar.goto();
    await ar.verify();
  });

  test('shows Accts. Rec. tab in navigation', async ({ page }) => {
    const ar = new ARPage(page);
    await ar.goto();
    const basePage = new BasePage(page);
    await expect(basePage.navTab('Accts. Rec.')).toBeVisible();
  });

  // ------------------------------------------------------------------
  // Sub-tabs
  // ------------------------------------------------------------------

  test('four sub-tabs are present', async ({ page }) => {
    const ar = new ARPage(page);
    await ar.goto();

    const subTabs = ['Dashboard', 'Invoices', 'Queue', 'Activity'];
    for (const label of subTabs) {
      await expect(page.getByRole('button', { name: label }).or(page.locator(`text=${label}`)).first()).toBeVisible();
    }
  });

  test('Dashboard sub-tab shows aging bucket section', async ({ page }) => {
    const ar = new ARPage(page);
    await ar.goto();
    await page.waitForLoadState('networkidle');

    // Dashboard is the default tab — aging buckets should be visible
    await expect(
      page.locator('text=/1.{0,5}15 days|1–15|Days Overdue/i').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('Invoices sub-tab shows invoice table', async ({ page }) => {
    const ar = new ARPage(page);
    await ar.goto();

    await page.getByRole('button', { name: 'Invoices' }).first().click();
    await page.waitForLoadState('networkidle');

    // Table or empty state should be present
    const table = ar.invoiceTable;
    const empty = page.locator('text=/no invoices|no data|nothing/i');
    await expect(table.or(empty).first()).toBeVisible({ timeout: 10000 });
  });

  test('Queue sub-tab shows due-today section', async ({ page }) => {
    const ar = new ARPage(page);
    await ar.goto();

    await page.getByRole('button', { name: 'Queue' }).first().click();
    await page.waitForLoadState('networkidle');

    await expect(
      page.locator('text=/Due Today|Upcoming/i').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('Activity sub-tab shows activity log search or empty state', async ({ page }) => {
    const ar = new ARPage(page);
    await ar.goto();

    await page.getByRole('button', { name: 'Activity' }).first().click();
    await page.waitForLoadState('networkidle');

    // Search input or empty state
    const search = page.getByPlaceholder(/search/i);
    const empty = page.locator('text=/no activity|nothing/i');
    await expect(search.or(empty).first()).toBeVisible({ timeout: 10000 });
  });

  // ------------------------------------------------------------------
  // Sync buttons
  // ------------------------------------------------------------------

  test('Sync from QB button is visible', async ({ page }) => {
    const ar = new ARPage(page);
    await ar.goto();
    await expect(ar.syncQBButton).toBeVisible();
  });

  test('Sync Payments button is visible', async ({ page }) => {
    const ar = new ARPage(page);
    await ar.goto();
    await expect(ar.syncPaymentsButton).toBeVisible();
  });

  test('Sync Emails button is visible', async ({ page }) => {
    const ar = new ARPage(page);
    await ar.goto();
    await expect(ar.syncEmailsButton).toBeVisible();
  });

  // ------------------------------------------------------------------
  // Invoice detail drawer
  // ------------------------------------------------------------------

  test('clicking an invoice row opens the detail drawer', async ({ page }) => {
    const ar = new ARPage(page);
    await ar.goto();

    await page.getByRole('button', { name: 'Invoices' }).first().click();
    await page.waitForLoadState('networkidle');

    const rows = page.locator('tbody tr');
    const count = await rows.count();

    if (count > 0) {
      await rows.first().click();
      // Drawer should slide in — look for financial strip labels
      await expect(
        page.locator('text=/Invoice Total|Balance Due|Stage/i').first()
      ).toBeVisible({ timeout: 5000 });
    }
    // If no invoices, test passes (no data to open)
  });

  test('detail drawer shows action buttons when open', async ({ page }) => {
    const ar = new ARPage(page);
    await ar.goto();

    await page.getByRole('button', { name: 'Invoices' }).first().click();
    await page.waitForLoadState('networkidle');

    const rows = page.locator('tbody tr');
    const count = await rows.count();

    if (count > 0) {
      await rows.first().click();
      await page.waitForTimeout(500);

      // At least one action button should be visible
      const actionBtn = page.getByRole('button', { name: /Log Call|Add Note|Promise to Pay|Dispute|Send Next Stage/i });
      await expect(actionBtn.first()).toBeVisible({ timeout: 5000 });
    }
  });

  // ------------------------------------------------------------------
  // No errors
  // ------------------------------------------------------------------

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    const ar = new ARPage(page);
    await ar.goto();

    expect(errors).toHaveLength(0);
  });
});
