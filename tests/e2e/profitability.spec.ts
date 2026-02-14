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

  test('By Customer tab has sortable column headers', async ({ page }) => {
    const profitability = new ProfitabilityPage(page);
    await profitability.goto();

    await page.getByRole('button', { name: /by customer/i }).click();
    await page.waitForLoadState('networkidle');

    // Check if table exists (data-dependent)
    const tableHeader = page.locator('text=Customer Profitability');
    const emptyState = page.locator('text=No Customer Data');
    const hasData = await tableHeader.isVisible().catch(() => false);

    if (hasData) {
      // Verify all expected column headers exist
      const headerRow = page.locator('thead th');
      const headers = await headerRow.allTextContents();
      const headerTexts = headers.map(h => h.replace(/[▲▼]/g, '').trim().toLowerCase());
      expect(headerTexts).toContain('customer');
      expect(headerTexts).toContain('revenue');
      expect(headerTexts).toContain('cost');
      expect(headerTexts).toContain('margin');
      expect(headerTexts).toContain('margin %');
      expect(headerTexts).toContain('hours');
      expect(headerTexts).toContain('util %');

      // Clicking a header should toggle sort direction
      const revenueHeader = page.locator('thead th', { hasText: 'Revenue' });
      await revenueHeader.click();
      const afterClick = await revenueHeader.textContent();
      expect(afterClick).toMatch(/[▲▼]/);
    }
  });

  test('By Customer tab shows summary cards when data exists', async ({ page }) => {
    const profitability = new ProfitabilityPage(page);
    await profitability.goto();

    await page.getByRole('button', { name: /by customer/i }).click();
    await page.waitForLoadState('networkidle');

    const hasData = await page.locator('text=Customer Profitability').isVisible().catch(() => false);
    if (hasData) {
      // Summary cards should show Customers, Total Revenue, Total Margin, Billable Hours
      await expect(page.locator('text=Customers')).toBeVisible();
      await expect(page.locator('text=Total Revenue')).toBeVisible();
      await expect(page.locator('text=Total Margin')).toBeVisible();
      await expect(page.locator('text=Billable Hours')).toBeVisible();
    }
  });

  test('By Customer tab has summary footer row', async ({ page }) => {
    const profitability = new ProfitabilityPage(page);
    await profitability.goto();

    await page.getByRole('button', { name: /by customer/i }).click();
    await page.waitForLoadState('networkidle');

    const hasData = await page.locator('text=Customer Profitability').isVisible().catch(() => false);
    if (hasData) {
      // Footer row with totals
      const footer = page.locator('tfoot tr');
      await expect(footer).toBeVisible();
      const footerText = await footer.textContent();
      expect(footerText).toContain('Total');
      expect(footerText).toContain('customers');
    }
  });

  test('drill-down modal shows all expected sections', async ({ page }) => {
    const profitability = new ProfitabilityPage(page);
    await profitability.goto();

    await page.getByRole('button', { name: /by customer/i }).click();
    await page.waitForLoadState('networkidle');

    const tableBody = page.locator('tbody tr');
    const rowCount = await tableBody.count();

    if (rowCount > 0) {
      await tableBody.first().click();
      await expect(page.locator('text=Customer Profitability Detail')).toBeVisible({ timeout: 5000 });

      // Summary cards in the modal
      await expect(page.locator('text=Total Revenue').first()).toBeVisible();
      await expect(page.locator('text=Labor Cost').first()).toBeVisible();

      // Check for Employee Breakdown section (if data exists)
      const employeeSection = page.locator('text=Employee Breakdown');
      const serviceSection = page.locator('text=Service Item Breakdown');
      const noData = page.locator('text=No profitability data');

      // Should have either breakdown tables or no-data message
      const hasEmployees = await employeeSection.isVisible().catch(() => false);
      const hasServices = await serviceSection.isVisible().catch(() => false);
      const hasNoData = await noData.isVisible().catch(() => false);

      // At least one of these should be visible
      expect(hasEmployees || hasServices || hasNoData).toBeTruthy();

      if (hasEmployees) {
        // Employee table should have expected columns
        const empTable = employeeSection.locator('..').locator('table');
        const empHeaders = await empTable.locator('thead th').allTextContents();
        const empHeaderTexts = empHeaders.map(h => h.trim().toLowerCase());
        expect(empHeaderTexts).toContain('employee');
        expect(empHeaderTexts).toContain('hours');
        expect(empHeaderTexts).toContain('cost');
        expect(empHeaderTexts).toContain('revenue');
        expect(empHeaderTexts).toContain('margin %');
      }

      if (hasServices) {
        // Service table should have expected columns
        const siTable = serviceSection.locator('..').locator('table');
        const siHeaders = await siTable.locator('thead th').allTextContents();
        const siHeaderTexts = siHeaders.map(h => h.trim().toLowerCase());
        expect(siHeaderTexts).toContain('service');
        expect(siHeaderTexts).toContain('hours');
        expect(siHeaderTexts).toContain('revenue');
        expect(siHeaderTexts).toContain('avg rate');
        expect(siHeaderTexts).toContain('entries');
      }

      // Close modal
      const closeButton = page.locator('button').filter({ has: page.locator('svg.lucide-x') });
      await closeButton.click();
      await expect(page.locator('text=Customer Profitability Detail')).not.toBeVisible();
    }
  });

  test('drill-down modal shows margin badge in header', async ({ page }) => {
    const profitability = new ProfitabilityPage(page);
    await profitability.goto();

    await page.getByRole('button', { name: /by customer/i }).click();
    await page.waitForLoadState('networkidle');

    const tableBody = page.locator('tbody tr');
    const rowCount = await tableBody.count();

    if (rowCount > 0) {
      await tableBody.first().click();
      await expect(page.locator('text=Customer Profitability Detail')).toBeVisible({ timeout: 5000 });

      // Header should have a margin badge with % and color
      const modalHeader = page.locator('.bg-gradient-to-r');
      const marginBadge = modalHeader.locator('span.rounded-full').filter({ hasText: /margin/ });
      await expect(marginBadge).toBeVisible();

      const badgeClasses = await marginBadge.getAttribute('class');
      expect(badgeClasses).toMatch(/bg-(green|amber|red)-100/);

      // Close
      const closeButton = page.locator('button').filter({ has: page.locator('svg.lucide-x') });
      await closeButton.click();
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
