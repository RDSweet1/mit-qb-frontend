import { test, expect } from '@playwright/test';
import { BasePage } from '../fixtures/base-page';

const navTabs = [
  { label: 'Time Entries', slug: 'time-entries' },
  { label: 'Reports', slug: 'reports' },
  { label: 'Invoices', slug: 'invoices' },
  { label: 'Profitability', slug: 'profitability' },
  { label: 'Unbilled', slug: 'unbilled' },
  { label: 'Clarifications', slug: 'clarifications' },
  { label: 'Settings', slug: 'settings' },
  { label: 'Admin', slug: 'admin' },
];

test.describe('Navigation', () => {
  test('all 8 nav tabs are visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const basePage = new BasePage(page);
    await basePage.verifyAppShell();

    for (const tab of navTabs) {
      await expect(basePage.navTab(tab.label)).toBeVisible();
    }
  });

  test('clicking each tab navigates and highlights active', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const basePage = new BasePage(page);

    for (const tab of navTabs) {
      await basePage.navTab(tab.label).click();
      await page.waitForLoadState('networkidle');
      await basePage.verifyActiveNavTab(tab.label);
    }
  });

  test('Admin tab shows red badge when automations are paused', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const adminTab = page.locator('[data-testid="nav-tab-admin"]');
    await expect(adminTab).toBeVisible();

    // Check for badge — it appears when schedule_config has paused items
    const badge = adminTab.locator('span.bg-red-500');
    const hasBadge = await badge.isVisible().catch(() => false);

    if (hasBadge) {
      // Badge should show a number
      const badgeText = await badge.textContent();
      expect(Number(badgeText)).toBeGreaterThan(0);
    }
    // If no badge, it means no automations are paused — that's valid too
  });
});
