import { test, expect } from '@playwright/test';
import { OverheadPage } from '../pages/overhead.page';

test.describe('Overhead', () => {
  test('loads with correct page header', async ({ page }) => {
    const overhead = new OverheadPage(page);
    await overhead.goto();
    await overhead.verify();
  });

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    const overhead = new OverheadPage(page);
    await overhead.goto();

    expect(errors).toHaveLength(0);
  });
});
