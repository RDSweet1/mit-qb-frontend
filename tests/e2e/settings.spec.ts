import { test, expect } from '@playwright/test';
import { SettingsPage } from '../pages/settings.page';

test.describe('Settings', () => {
  test('loads with correct page header', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();
    await settings.verify();
  });

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    const settings = new SettingsPage(page);
    await settings.goto();

    expect(errors).toHaveLength(0);
  });
});
