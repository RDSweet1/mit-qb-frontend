import { test, expect } from '../fixtures/test';
import { UnbilledPage } from '../pages/unbilled.page';
import { BASE_PATH } from '../fixtures/base-page';

test.describe('Unbilled Time', () => {
  test('loads with correct page header', async ({ page }) => {
    const unbilled = new UnbilledPage(page);
    await unbilled.goto();
    await unbilled.verify();
  });

  test('shows period preset buttons', async ({ page }) => {
    const unbilled = new UnbilledPage(page);
    await unbilled.goto();

    await expect(page.getByRole('button', { name: 'This Week' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Last Week' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'This Month' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Last Month' })).toBeVisible();
  });

  test('shows summary stat cards', async ({ page }) => {
    const unbilled = new UnbilledPage(page);
    await unbilled.goto();

    // Summary cards for entries, hours, customers, employees
    await expect(page.getByText('Unbilled Entries')).toBeVisible();
    await expect(page.getByText('Unbilled Hours')).toBeVisible();
    await expect(page.getByText('Affected Customers')).toBeVisible();
    await expect(page.getByText('Affected Employees')).toBeVisible();
  });

  test('has employee and customer filter dropdowns', async ({ page }) => {
    const unbilled = new UnbilledPage(page);
    await unbilled.goto();

    const selects = page.locator('select');
    // Employee filter, customer filter, and sort dropdown
    await expect(selects).toHaveCount(3, { timeout: 10_000 });
  });

  test('has Export CSV button', async ({ page }) => {
    const unbilled = new UnbilledPage(page);
    await unbilled.goto();

    await expect(page.getByRole('button', { name: /export csv/i })).toBeVisible();
  });

  test('switching period preset updates date inputs', async ({ page }) => {
    const unbilled = new UnbilledPage(page);
    await unbilled.goto();

    const startInput = page.locator('input[type="date"]').first();
    const endInput = page.locator('input[type="date"]').last();

    // Default is Last Month — get current values
    const initialStart = await startInput.inputValue();

    // Switch to This Week
    await page.getByRole('button', { name: 'This Week' }).click();
    await page.waitForLoadState('networkidle');

    const newStart = await startInput.inputValue();
    expect(newStart).not.toBe(initialStart);
  });

  test('shows empty state or table when data loads', async ({ page }) => {
    const unbilled = new UnbilledPage(page);
    await unbilled.goto();

    // Wait for loading to finish
    await page.waitForLoadState('networkidle');

    // Either shows "No Unbilled Time" empty state or a data table
    const emptyState = page.getByText('No Unbilled Time');
    const table = page.locator('table');

    const hasEmpty = await emptyState.isVisible().catch(() => false);
    const hasTable = await table.isVisible().catch(() => false);

    expect(hasEmpty || hasTable).toBeTruthy();
  });

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    const unbilled = new UnbilledPage(page);
    await unbilled.goto();

    expect(errors).toHaveLength(0);
  });
});
