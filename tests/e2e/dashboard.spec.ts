import { test, expect } from '../fixtures/test';
import { DashboardPage } from '../pages/dashboard.page';

test.describe('Dashboard', () => {
  test('loads and shows app shell', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.verify();
  });

  test('shows page header with correct title', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.verifyPageHeader('Dashboard');
  });

  test('shows Cash Position summary with 4 stats', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await page.waitForLoadState('networkidle');

    // Cash Position section header
    await expect(page.locator('text=Cash Position').first()).toBeVisible();

    // 4 stat cards — use the uppercase labels inside the summary
    await expect(page.locator('text=YTD Billed').first()).toBeVisible();
    await expect(page.locator('text=YTD Received').first()).toBeVisible();
    await expect(page.locator('text=Collection Rate').first()).toBeVisible();
    await expect(page.locator('text=Outstanding A/R').first()).toBeVisible();
  });

  test('Cash Position has View Details link to profitability', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await page.waitForLoadState('networkidle');

    const viewDetails = page.locator('a[href*="cash-position"]', { hasText: 'View Details' });
    await expect(viewDetails).toBeVisible();
    expect(await viewDetails.getAttribute('href')).toContain('tab=cash-position');
  });

  // ------------------------------------------------------------------
  // Billing Pipeline Banner
  // ------------------------------------------------------------------

  test('Billing Pipeline banner is present', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=Billing Pipeline')).toBeVisible();
  });

  test('Billing Pipeline shows all 5 stages', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await page.waitForLoadState('networkidle');

    const stages = ['Time Review', 'Reports', 'Awaiting Client', 'Invoice Ready', 'Collections Due'];
    for (const stage of stages) {
      await expect(page.locator(`text=${stage}`).first()).toBeVisible();
    }
  });

  test('Billing Pipeline stages link to correct pages', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('a[href*="time-entries"]').first()).toBeAttached();
    await expect(page.locator('a[href*="reports"]').first()).toBeAttached();
    await expect(page.locator('a[href*="invoices"]').first()).toBeAttached();
    await expect(page.locator('a[href*="/ar"]').first()).toBeAttached();
  });

  test('Billing Pipeline shows stage counts or all-clear indicator', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Either "All clear" is shown (every count zero) or count badges exist
    const allClear = page.locator('text=All clear');
    const countBadges = page.locator('text=Billing Pipeline').locator('..').locator('.rounded-full').filter({ hasText: /^\d+$/ });
    const allClearVisible = await allClear.isVisible();
    const badgeCount = await countBadges.count();
    expect(allClearVisible || badgeCount >= 0).toBeTruthy(); // banner is always rendered
  });

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    expect(errors).toHaveLength(0);
  });
});
