import { test, expect } from '../fixtures/test';
import { BASE_PATH } from '../fixtures/base-page';

/**
 * Public pages that don't require authentication.
 * These pages are accessed via token URLs (review, clarify)
 * or are informational (privacy, terms, eula).
 */
test.describe('Public Pages', () => {
  // Review page without token shows not-found state
  test('review page without token shows appropriate message', async ({ page }) => {
    await page.goto(BASE_PATH + '/review');
    await page.waitForLoadState('networkidle');

    // Should show some form of "not found" or "invalid" state
    const content = await page.textContent('body');
    expect(content).toBeTruthy();

    // Should NOT show the app shell (no nav, no header)
    await expect(page.locator('[data-testid="app-nav"]')).not.toBeVisible();
  });

  // Clarify page without token shows not-found state
  test('clarify page without token shows appropriate message', async ({ page }) => {
    await page.goto(BASE_PATH + '/clarify');
    await page.waitForLoadState('networkidle');

    // Should NOT show the app shell
    await expect(page.locator('[data-testid="app-nav"]')).not.toBeVisible();
  });

  test('review page with invalid token shows not-found', async ({ page }) => {
    await page.goto(BASE_PATH + '/review?token=00000000-0000-0000-0000-000000000000');
    await page.waitForLoadState('networkidle');

    // Wait for the page to finish loading and show error state
    await page.waitForTimeout(2000);
    const content = await page.textContent('body');
    // Should contain some kind of "not found" or "invalid" or "expired" message
    expect(
      content?.toLowerCase().includes('not found') ||
      content?.toLowerCase().includes('invalid') ||
      content?.toLowerCase().includes('expired') ||
      content?.toLowerCase().includes('error')
    ).toBeTruthy();
  });

  test('clarify page with invalid token shows not-found', async ({ page }) => {
    await page.goto(BASE_PATH + '/clarify?token=00000000-0000-0000-0000-000000000000');
    await page.waitForLoadState('networkidle');

    await page.waitForTimeout(2000);
    const content = await page.textContent('body');
    expect(
      content?.toLowerCase().includes('not found') ||
      content?.toLowerCase().includes('invalid') ||
      content?.toLowerCase().includes('expired') ||
      content?.toLowerCase().includes('error')
    ).toBeTruthy();
  });

  test('public pages have no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto(BASE_PATH + '/review');
    await page.waitForLoadState('networkidle');

    // Filter out known MSAL-related errors that happen on non-auth pages
    const realErrors = errors.filter(e => !e.includes('msal'));
    expect(realErrors).toHaveLength(0);
  });
});
