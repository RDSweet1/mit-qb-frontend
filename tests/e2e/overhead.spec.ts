import { test, expect } from '@playwright/test';
import { BASE_PATH } from '../fixtures/base-page';

test.describe('Overhead', () => {
  test('old /overhead route redirects to profitability vendor-overhead tab', async ({ page }) => {
    await page.goto(BASE_PATH + '/overhead');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/profitability');
    expect(page.url()).toContain('tab=vendor-overhead');
  });
});
