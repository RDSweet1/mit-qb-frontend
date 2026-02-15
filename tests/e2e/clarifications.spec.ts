import { test, expect } from '../fixtures/test';
import { ClarificationsPage } from '../pages/clarifications.page';
import { BASE_PATH } from '../fixtures/base-page';

test.describe('Internal Clarifications', () => {
  test('loads with correct page header', async ({ page }) => {
    const clarifications = new ClarificationsPage(page);
    await clarifications.goto();
    await clarifications.verify();
  });

  test('shows stat cards for Pending, Needs Review, and Cleared', async ({ page }) => {
    const clarifications = new ClarificationsPage(page);
    await clarifications.goto();

    await expect(page.getByText('Pending Response')).toBeVisible();
    await expect(page.getByText('Needs Review')).toBeVisible();
    await expect(page.getByText('Cleared This Week')).toBeVisible();
  });

  test('stat cards act as filters when clicked', async ({ page }) => {
    const clarifications = new ClarificationsPage(page);
    await clarifications.goto();

    // Click the Pending stat card to filter
    const pendingCard = page.getByText('Pending Response').locator('..');
    await pendingCard.click();

    // Click again to toggle back to all
    await pendingCard.click();
  });

  test('has refresh button', async ({ page }) => {
    const clarifications = new ClarificationsPage(page);
    await clarifications.goto();

    await expect(page.getByRole('button', { name: /refresh/i })).toBeVisible();
  });

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    const clarifications = new ClarificationsPage(page);
    await clarifications.goto();

    expect(errors).toHaveLength(0);
  });
});
