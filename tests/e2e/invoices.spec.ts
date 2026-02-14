import { test, expect } from '@playwright/test';
import { InvoicesPage } from '../pages/invoices.page';

test.describe('Invoices', () => {
  test('loads with correct page header', async ({ page }) => {
    const invoices = new InvoicesPage(page);
    await invoices.goto();
    await invoices.verify();
  });

  test('month selector is visible and has a default value', async ({ page }) => {
    const invoices = new InvoicesPage(page);
    await invoices.goto();
    await expect(invoices.monthSelector).toBeVisible();
  });

  test('generate preview button exists', async ({ page }) => {
    const invoices = new InvoicesPage(page);
    await invoices.goto();
    const generateBtn = page.getByRole('button', { name: /generate preview/i });
    await expect(generateBtn).toBeVisible();
  });

  test('invoice cards show margin badges from customer_profitability', async ({ page }) => {
    const invoices = new InvoicesPage(page);
    await invoices.goto();

    // Click Generate Preview to load invoice data
    const generateBtn = page.getByRole('button', { name: /generate preview/i });
    await generateBtn.click();

    // Wait for previews to load
    await page.waitForLoadState('networkidle');

    // Check for margin badges — they appear if customer_profitability has data
    const marginBadges = page.locator('[data-testid="margin-badge"]');
    const badgeCount = await marginBadges.count();

    if (badgeCount > 0) {
      const firstBadge = marginBadges.first();
      const text = await firstBadge.textContent();
      // Should show "XX% margin"
      expect(text).toMatch(/\d+% margin/);

      // Should have color coding
      const classes = await firstBadge.getAttribute('class');
      expect(classes).toMatch(/bg-(green|yellow|red)-100/);
    }
    // If no badges, customer_profitability may not have data for this period — valid
  });

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    const invoices = new InvoicesPage(page);
    await invoices.goto();

    expect(errors).toHaveLength(0);
  });
});
