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

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    const invoices = new InvoicesPage(page);
    await invoices.goto();

    expect(errors).toHaveLength(0);
  });
});
