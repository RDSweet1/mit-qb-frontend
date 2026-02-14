import { test, expect } from '@playwright/test';
import { ProfitabilityPage } from '../pages/profitability.page';

test.describe('Profitability', () => {
  test('loads with correct page header', async ({ page }) => {
    const profitability = new ProfitabilityPage(page);
    await profitability.goto();
    await profitability.verify();
  });

  test('has 5 tabs including By Customer and vendor overhead', async ({ page }) => {
    const profitability = new ProfitabilityPage(page);
    await profitability.goto();
    await expect(page.getByRole('button', { name: /profitability/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /by customer/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /p&l summary/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^overhead$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /vendor overhead/i })).toBeVisible();
  });

  test('By Customer tab renders table or empty state', async ({ page }) => {
    const profitability = new ProfitabilityPage(page);
    await profitability.goto();

    // Click the By Customer tab
    await page.getByRole('button', { name: /by customer/i }).click();

    // Should show either the customer table or the empty state
    const table = page.locator('text=Customer Profitability');
    const emptyState = page.locator('text=No Customer Data');
    await expect(table.or(emptyState)).toBeVisible({ timeout: 10000 });
  });

  test('By Customer tab has color-coded margin badges when data exists', async ({ page }) => {
    const profitability = new ProfitabilityPage(page);
    await profitability.goto();

    await page.getByRole('button', { name: /by customer/i }).click();
    await page.waitForLoadState('networkidle');

    // If data exists, check for margin badge styling
    const marginBadges = page.locator('span.rounded-full').filter({ hasText: /%/ });
    const count = await marginBadges.count();
    if (count > 0) {
      // Verify at least one badge has the expected color classes
      const firstBadge = marginBadges.first();
      const classes = await firstBadge.getAttribute('class');
      expect(classes).toMatch(/bg-(green|amber|red)-100/);
    }
  });

  test('clicking customer row opens drill-down modal', async ({ page }) => {
    const profitability = new ProfitabilityPage(page);
    await profitability.goto();

    await page.getByRole('button', { name: /by customer/i }).click();
    await page.waitForLoadState('networkidle');

    // Check if there are customer rows
    const tableBody = page.locator('tbody tr');
    const rowCount = await tableBody.count();

    if (rowCount > 0) {
      // Click the first customer row
      await tableBody.first().click();

      // Drill-down modal should appear
      await expect(page.locator('text=Customer Profitability Detail')).toBeVisible({ timeout: 5000 });

      // Verify modal has expected sections
      await expect(page.locator('text=Total Revenue').first()).toBeVisible();

      // Close the modal
      const closeButton = page.locator('button').filter({ has: page.locator('svg.lucide-x') });
      await closeButton.click();

      // Modal should be gone
      await expect(page.locator('text=Customer Profitability Detail')).not.toBeVisible();
    }
  });

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    const profitability = new ProfitabilityPage(page);
    await profitability.goto();

    expect(errors).toHaveLength(0);
  });
});
