import { test, expect } from '@playwright/test';
import { ReportsPage } from '../pages/reports.page';

test.describe('Reports', () => {
  test('loads with correct page header', async ({ page }) => {
    const reports = new ReportsPage(page);
    await reports.goto();
    await reports.verify();
  });

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    const reports = new ReportsPage(page);
    await reports.goto();

    expect(errors).toHaveLength(0);
  });
});
