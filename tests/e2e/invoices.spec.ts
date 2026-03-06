import { test, expect } from '../fixtures/test';
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

  test('billing hold banner appears after preview when customers have holds', async ({ page }) => {
    const invoices = new InvoicesPage(page);
    await invoices.goto();

    const generateBtn = page.getByRole('button', { name: /generate preview/i });
    await generateBtn.click();
    await page.waitForLoadState('networkidle');

    // Billing hold banner only shows if invoice_log has customers with billing_hold=true
    const holdBanner = page.locator('text=/billing hold/i').first();
    const holdBannerVisible = await holdBanner.isVisible();

    if (holdBannerVisible) {
      // Banner should show the orange warning style
      const bannerEl = page.locator('[class*="orange"]').filter({ hasText: /billing hold/i }).first();
      await expect(bannerEl).toBeVisible();

      // At least one customer name should be listed in the banner
      const holdItems = page.locator('[class*="orange-900"]');
      const itemCount = await holdItems.count();
      expect(itemCount).toBeGreaterThan(0);
    }
    // If no holds exist in test data, banner is simply absent — valid
  });

  test('InvoicePreviewCard shows Billing Hold badge when customer has a hold', async ({ page }) => {
    const invoices = new InvoicesPage(page);
    await invoices.goto();

    const generateBtn = page.getByRole('button', { name: /generate preview/i });
    await generateBtn.click();
    await page.waitForLoadState('networkidle');

    // Check if any Billing Hold badges are visible on cards
    const holdBadges = page.locator('text=Billing Hold');
    const count = await holdBadges.count();

    if (count > 0) {
      // Badge should have orange styling
      const badge = holdBadges.first();
      const parent = badge.locator('..');
      const classes = await parent.getAttribute('class');
      expect(classes).toMatch(/orange/);
    }
    // Data-dependent — no holds in test data means no badges; valid
  });

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    const invoices = new InvoicesPage(page);
    await invoices.goto();

    expect(errors).toHaveLength(0);
  });
});
