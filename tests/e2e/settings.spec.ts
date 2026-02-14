import { test, expect } from '@playwright/test';
import { SettingsPage } from '../pages/settings.page';

test.describe('Settings', () => {
  test('loads with correct page header', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();
    await settings.verify();
  });

  test('shows automation section with live schedule data', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();

    // Automation section header
    await expect(page.getByRole('heading', { name: 'Automation' })).toBeVisible();
    await expect(page.getByText('Scheduled tasks and automation status')).toBeVisible();

    // Should show all 5 automation names from schedule_config
    await expect(page.getByText('Weekly Reports', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Follow-Up Reminders', { exact: true })).toBeVisible();
    await expect(page.getByText('Auto-Accept', { exact: true })).toBeVisible();
    await expect(page.getByText('Reconciliation', { exact: true })).toBeVisible();
    await expect(page.getByText('Profitability Report', { exact: true })).toBeVisible();
  });

  test('each automation shows schedule day and time', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();

    // Wait for schedule data to load
    await expect(page.locator('text=Weekly Reports')).toBeVisible({ timeout: 10000 });

    // Each automation card should show day @ time format
    const automationCards = page.locator('.rounded-lg').filter({ hasText: /@ \d+:\d+ [AP]M/ });
    const cardCount = await automationCards.count();
    expect(cardCount).toBeGreaterThanOrEqual(5);
  });

  test('paused automation shows red styling and badge', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();

    await expect(page.locator('text=Weekly Reports')).toBeVisible({ timeout: 10000 });

    // Check if any automation is paused — if so, verify red styling
    const pausedBadges = page.locator('text=Paused');
    const pausedCount = await pausedBadges.count();

    if (pausedCount > 0) {
      // Paused items should have red background
      const pausedCard = page.locator('.bg-red-50').first();
      await expect(pausedCard).toBeVisible();
    }
  });

  test('shows admin scheduling note', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();

    await expect(page.locator('text=Schedules can be modified by administrators')).toBeVisible();
  });

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    const settings = new SettingsPage(page);
    await settings.goto();

    expect(errors).toHaveLength(0);
  });
});
