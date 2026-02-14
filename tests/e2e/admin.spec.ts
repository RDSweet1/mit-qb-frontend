import { test, expect } from '@playwright/test';
import { AdminPage } from '../pages/admin.page';
import { BasePage } from '../fixtures/base-page';

test.describe('Admin', () => {
  test('users page loads with correct header', async ({ page }) => {
    const admin = new AdminPage(page);
    await admin.goto();
    await admin.verify();
  });

  test('employee rates page loads', async ({ page }) => {
    await page.goto('/admin/employee-rates');
    await page.waitForLoadState('networkidle');
    const basePage = new BasePage(page);
    await basePage.verifyAppShell();
    await basePage.verifyPageHeader('Employee Cost Rates');
  });

  test('report recipients page loads', async ({ page }) => {
    await page.goto('/admin/report-recipients');
    await page.waitForLoadState('networkidle');
    const basePage = new BasePage(page);
    await basePage.verifyAppShell();
    await basePage.verifyPageHeader('Report Recipients');
  });

  test('no console errors on admin pages', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    const admin = new AdminPage(page);
    await admin.goto();

    expect(errors).toHaveLength(0);
  });
});
