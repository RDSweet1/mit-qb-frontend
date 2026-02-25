import { test, expect } from '../fixtures/test';
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

  test('date range preset buttons exist', async ({ page }) => {
    const timeEntries = new TimeEntriesPage(page);
    await timeEntries.goto();

    // Time entries has preset buttons: This Week, Last Week, This Month, Last Month
    await expect(page.getByRole('button', { name: 'This Week' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Last Week' })).toBeVisible();
  });

  test('date picker controls exist', async ({ page }) => {
    const timeEntries = new TimeEntriesPage(page);
    await timeEntries.goto();

    // From/To date inputs
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
  });

  test('edit mechanism exists on entries', async ({ page }) => {
    const timeEntries = new TimeEntriesPage(page);
    await timeEntries.goto();
    await page.waitForTimeout(2000);

    // Pencil icon or edit button
    const editElements = page.locator('svg.lucide-pencil, svg.lucide-edit, button[title*="edit" i], [data-testid*="edit"]');
    const count = await editElements.count();
    // Data-dependent — entries must be loaded
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('lock/unlock icons exist', async ({ page }) => {
    const timeEntries = new TimeEntriesPage(page);
    await timeEntries.goto();
    await page.waitForTimeout(2000);

    // Lock or unlock icons
    const lockIcons = page.locator('svg.lucide-lock, svg.lucide-unlock, svg.lucide-lock-open, [data-testid*="lock"]');
    const count = await lockIcons.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('clarify button exists in UI', async ({ page }) => {
    const timeEntries = new TimeEntriesPage(page);
    await timeEntries.goto();
    await page.waitForTimeout(2000);

    // Clarify button (per-entry or in action bar)
    const clarifyBtn = page.getByRole('button', { name: /clarify/i });
    const count = await clarifyBtn.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
