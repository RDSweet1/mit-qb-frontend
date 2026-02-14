import { test, expect } from '@playwright/test';

test.describe('Overhead', () => {
  test('old /overhead route redirects to profitability vendor-overhead tab', async ({ page }) => {
    await page.goto('/overhead');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/profitability');
    expect(page.url()).toContain('tab=vendor-overhead');
  });
});
