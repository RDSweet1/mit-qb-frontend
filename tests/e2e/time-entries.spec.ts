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

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    const timeEntries = new TimeEntriesPage(page);
    await timeEntries.goto();

    expect(errors).toHaveLength(0);
  });
});
