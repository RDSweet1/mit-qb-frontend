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

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    expect(errors).toHaveLength(0);
  });
});
