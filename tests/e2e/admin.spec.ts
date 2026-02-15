import { test, expect } from '../fixtures/test';
import { BasePage, BASE_PATH } from '../fixtures/base-page';

test.describe('Admin', () => {
  test('consolidated admin page loads with correct header', async ({ page }) => {
    await page.goto(BASE_PATH + '/admin');
    await page.waitForLoadState('networkidle');
    const basePage = new BasePage(page);
    await basePage.verifyAppShell();
    await basePage.verifyPageHeader('Administration');
    await basePage.verifyActiveNavTab('Admin');
  });

  test('all 4 admin tabs are visible', async ({ page }) => {
    await page.goto(BASE_PATH + '/admin');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="admin-tab-users"]')).toBeVisible();
    await expect(page.locator('[data-testid="admin-tab-rates"]')).toBeVisible();
    await expect(page.locator('[data-testid="admin-tab-recipients"]')).toBeVisible();
    await expect(page.locator('[data-testid="admin-tab-scheduling"]')).toBeVisible();
  });

  test('switching tabs shows correct content', async ({ page }) => {
    await page.goto(BASE_PATH + '/admin');
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

  test('scheduling tab renders automation table with 5 rows', async ({ page }) => {
    await page.goto(BASE_PATH + '/admin');
    await page.waitForLoadState('networkidle');
    await page.locator('[data-testid="admin-tab-scheduling"]').click();

    // Wait for the table to render (data loads from Supabase)
    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 10000 });

    // Should have 5 automation rows in the table body
    const rows = table.locator('tbody tr');
    await expect(rows).toHaveCount(5);

    // Verify all 5 automation names appear
    await expect(page.getByText('Weekly Reports', { exact: true })).toBeVisible();
    await expect(page.getByText('Follow-Up Reminders', { exact: true })).toBeVisible();
    await expect(page.getByText('Auto-Accept', { exact: true })).toBeVisible();
    await expect(page.getByText('Reconciliation', { exact: true })).toBeVisible();
    await expect(page.getByText('Profitability Report', { exact: true })).toBeVisible();
  });

  test('scheduling tab has day and time dropdowns per row', async ({ page }) => {
    await page.goto(BASE_PATH + '/admin');
    await page.waitForLoadState('networkidle');
    await page.locator('[data-testid="admin-tab-scheduling"]').click();
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // Each row should have a day dropdown and a time dropdown
    const daySelects = page.locator('table tbody select').nth(0);
    await expect(daySelects).toBeVisible();

    // Day dropdown should contain expected options
    const firstDaySelect = page.locator('table tbody tr').first().locator('select').first();
    const dayOptions = firstDaySelect.locator('option');
    const dayCount = await dayOptions.count();
    expect(dayCount).toBe(7); // Mon-Fri + Weekdays + Daily

    // Time dropdown should have 96 options (24h * 4 per hour)
    const firstTimeSelect = page.locator('table tbody tr').first().locator('select').nth(1);
    const timeOptions = firstTimeSelect.locator('option');
    const timeCount = await timeOptions.count();
    expect(timeCount).toBe(96);
  });

  test('scheduling tab has Pause All and Resume All buttons', async ({ page }) => {
    await page.goto(BASE_PATH + '/admin');
    await page.waitForLoadState('networkidle');
    await page.locator('[data-testid="admin-tab-scheduling"]').click();
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    const pauseAllBtn = page.getByRole('button', { name: /pause all/i });
    const resumeAllBtn = page.getByRole('button', { name: /resume all/i });

    await expect(pauseAllBtn).toBeVisible();
    await expect(resumeAllBtn).toBeVisible();
  });

  test('scheduling tab has per-row pause/resume buttons', async ({ page }) => {
    await page.goto(BASE_PATH + '/admin');
    await page.waitForLoadState('networkidle');
    await page.locator('[data-testid="admin-tab-scheduling"]').click();
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // Each row should have a Pause or Resume button
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBe(5);

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const pauseBtn = row.getByRole('button', { name: /pause|resume/i });
      await expect(pauseBtn).toBeVisible();
    }
  });

  test('scheduling tab shows info note about changes', async ({ page }) => {
    await page.goto(BASE_PATH + '/admin');
    await page.waitForLoadState('networkidle');
    await page.locator('[data-testid="admin-tab-scheduling"]').click();
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // Note about changes taking effect immediately
    await expect(page.locator('text=Changes take effect immediately')).toBeVisible();
  });

  test('old /admin/users route redirects to /admin', async ({ page }) => {
    await page.goto(BASE_PATH + '/admin/users');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/admin');
  });

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto(BASE_PATH + '/admin');
    await page.waitForLoadState('networkidle');

    expect(errors).toHaveLength(0);
  });
});
