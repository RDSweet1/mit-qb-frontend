import { test, expect } from '@playwright/test';
import { BasePage } from '../fixtures/base-page';

test.describe('Admin', () => {
  test('consolidated admin page loads with correct header', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    const basePage = new BasePage(page);
    await basePage.verifyAppShell();
    await basePage.verifyPageHeader('Administration');
    await basePage.verifyActiveNavTab('Admin');
  });

  test('all 4 admin tabs are visible', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="admin-tab-users"]')).toBeVisible();
    await expect(page.locator('[data-testid="admin-tab-rates"]')).toBeVisible();
    await expect(page.locator('[data-testid="admin-tab-recipients"]')).toBeVisible();
    await expect(page.locator('[data-testid="admin-tab-scheduling"]')).toBeVisible();
  });

  test('switching tabs shows correct content', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Default tab is Users
    await expect(page.locator('[data-testid="admin-tab-users"]')).toHaveClass(/border-indigo-600/);

    // Switch to Employee Rates
    await page.locator('[data-testid="admin-tab-rates"]').click();
    await expect(page.locator('[data-testid="admin-tab-rates"]')).toHaveClass(/border-indigo-600/);

    // Switch to Report Recipients
    await page.locator('[data-testid="admin-tab-recipients"]').click();
    await expect(page.locator('[data-testid="admin-tab-recipients"]')).toHaveClass(/border-indigo-600/);

    // Switch to Scheduling
    await page.locator('[data-testid="admin-tab-scheduling"]').click();
    await expect(page.locator('[data-testid="admin-tab-scheduling"]')).toHaveClass(/border-indigo-600/);
  });

  test('old /admin/users route redirects to /admin', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/admin');
  });

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    expect(errors).toHaveLength(0);
  });
});
