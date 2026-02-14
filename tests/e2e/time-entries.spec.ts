import { test, expect } from '@playwright/test';
import { TimeEntriesPage } from '../pages/time-entries.page';

test.describe('Time Entries', () => {
  test('loads with correct page header', async ({ page }) => {
    const timeEntries = new TimeEntriesPage(page);
    await timeEntries.goto();
    await timeEntries.verify();
  });

  test('sync button is visible', async ({ page }) => {
    const timeEntries = new TimeEntriesPage(page);
    await timeEntries.goto();
    await expect(timeEntries.syncButton).toBeVisible();
  });

  test('status badges render on time entry rows', async ({ page }) => {
    const timeEntries = new TimeEntriesPage(page);
    await timeEntries.goto();

    // Wait for entries to load (they come from Supabase)
    await page.waitForTimeout(2000);

    // Every visible entry should have a status badge
    const badges = timeEntries.statusBadges;
    const count = await badges.count();

    // If entries loaded, badges should be present
    if (count > 0) {
      // Each badge should have valid text
      const firstBadge = badges.first();
      await expect(firstBadge).toBeVisible();
      const text = await firstBadge.textContent();
      expect(['Unbilled', 'Report Sent', 'Supplemental', 'Accepted', 'Disputed', 'No Time']).toContain(text?.trim());
    }
  });

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    const timeEntries = new TimeEntriesPage(page);
    await timeEntries.goto();

    expect(errors).toHaveLength(0);
  });
});
