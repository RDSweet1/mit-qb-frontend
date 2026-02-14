import { test, expect } from '@playwright/test';
import { ProfitabilityPage } from '../pages/profitability.page';

test.describe('Profitability', () => {
  test('loads with correct page header', async ({ page }) => {
    const profitability = new ProfitabilityPage(page);
    await profitability.goto();
    await profitability.verify();
  });

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    const profitability = new ProfitabilityPage(page);
    await profitability.goto();

    expect(errors).toHaveLength(0);
  });
});
