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

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    expect(errors).toHaveLength(0);
  });
});
