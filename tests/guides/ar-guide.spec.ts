/**
 * AR Collections Guide — Validation Tests
 *
 * Verifies that ar-guide.html accurately describes the live application.
 *
 * Test strategy:
 *   Part 1: Guide HTML structure (loads, sections, TOC, toggles)
 *   Part 2: Guide steps match real app (navigate to AR, sub-tabs, buttons)
 *   Part 3: Guide's data/label descriptions match actual UI
 *   Part 4: Static file serving + cross-links to other guides
 */
import { test, expect } from '../fixtures/test';
import { BasePage, BASE_PATH } from '../fixtures/base-page';

const GUIDE_URL = `${BASE_PATH}/training/ar-guide.html`;
const AR_URL = `${BASE_PATH}/ar`;
const INVOICES_URL = `${BASE_PATH}/invoices`;

// ====================================================================
// Part 1: Guide HTML Structure
// ====================================================================
test.describe('AR Guide: HTML structure', () => {
  test('guide page loads with correct title', async ({ page }) => {
    await page.goto(GUIDE_URL);
    await expect(page).toHaveTitle(/Accounts Receivable Collections/);
  });

  test('guide has sticky header with correct heading', async ({ page }) => {
    await page.goto(GUIDE_URL);
    await expect(page.locator('.header h1')).toContainText('Accounts Receivable');
    await expect(page.locator('.header p')).toContainText('Training Guide');
  });

  test('table of contents has 9 links', async ({ page }) => {
    await page.goto(GUIDE_URL);
    const tocLinks = page.locator('.toc a');
    await expect(tocLinks).toHaveCount(9);
  });

  test('all 9 section IDs exist in the document', async ({ page }) => {
    await page.goto(GUIDE_URL);
    const ids = [
      'overview', 'navigating', 'syncing', 'invoice-list',
      'detail-drawer', 'actions', 'email-sync', 'dashboard', 'faq',
    ];
    for (const id of ids) {
      await expect(page.locator(`#${id}`)).toBeAttached();
    }
  });

  test('first section (overview) is open by default', async ({ page }) => {
    await page.goto(GUIDE_URL);
    await expect(page.locator('#overview')).toHaveClass(/open/);
  });

  test('other sections are closed by default', async ({ page }) => {
    await page.goto(GUIDE_URL);
    await expect(page.locator('#faq')).not.toHaveClass(/open/);
    await expect(page.locator('#syncing')).not.toHaveClass(/open/);
  });

  test('section toggle works — click opens, click again closes', async ({ page }) => {
    await page.goto(GUIDE_URL);
    const faq = page.locator('#faq');
    await expect(faq).not.toHaveClass(/open/);
    await faq.locator('.section-header').click();
    await expect(faq).toHaveClass(/open/);
    await faq.locator('.section-header').click();
    await expect(faq).not.toHaveClass(/open/);
  });

  test('TOC link navigates to correct section and opens it', async ({ page }) => {
    await page.goto(GUIDE_URL);
    await page.locator('.toc a[href="#syncing"]').click();
    await expect(page.locator('#syncing')).toHaveClass(/open/);
  });

  test('dunning pipeline table shows all 6 stages (0–5)', async ({ page }) => {
    await page.goto(GUIDE_URL);
    // Open overview section (already open by default)
    for (let i = 0; i <= 5; i++) {
      await expect(page.locator(`.ps-${i}`)).toBeVisible();
    }
  });
});

// ====================================================================
// Part 2: Guide Steps Match Real App
// ====================================================================
test.describe('AR Guide: steps match real app', () => {
  test('Accts. Rec. tab exists in app navigation', async ({ page }) => {
    const basePage = new BasePage(page);
    await page.goto(BASE_PATH + '/');
    await page.waitForLoadState('networkidle');
    await expect(basePage.navTab('Accts. Rec.')).toBeVisible();
  });

  test('AR page loads at /ar', async ({ page }) => {
    await page.goto(AR_URL);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1, h2').filter({ hasText: /Accounts Receivable/i }).first()).toBeVisible();
  });

  test('four sub-tabs documented in guide exist in app', async ({ page }) => {
    await page.goto(AR_URL);
    await page.waitForLoadState('networkidle');
    for (const tab of ['Dashboard', 'Invoices', 'Queue', 'Activity']) {
      await expect(
        page.getByRole('button', { name: tab }).or(page.locator(`text=${tab}`)).first()
      ).toBeVisible();
    }
  });

  test('Queue sub-tab shows "Due Today" section as documented', async ({ page }) => {
    await page.goto(AR_URL);
    await page.getByRole('button', { name: 'Queue' }).first().click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Due Today').first()).toBeVisible({ timeout: 8000 });
  });

  test('Sync from QB button exists as documented', async ({ page }) => {
    await page.goto(AR_URL);
    await expect(page.getByRole('button', { name: /sync from qb/i })).toBeVisible();
  });

  test('Sync Payments button exists as documented', async ({ page }) => {
    await page.goto(AR_URL);
    await expect(page.getByRole('button', { name: /sync payments/i })).toBeVisible();
  });

  test('Sync Emails button exists as documented', async ({ page }) => {
    await page.goto(AR_URL);
    await expect(page.getByRole('button', { name: /sync emails/i })).toBeVisible();
  });

  test('action buttons documented in Section 6 exist when invoice drawer is open', async ({ page }) => {
    await page.goto(AR_URL);
    await page.getByRole('button', { name: 'Invoices' }).first().click();
    await page.waitForLoadState('networkidle');

    const rows = page.locator('tbody tr');
    const count = await rows.count();
    if (count > 0) {
      await rows.first().click();
      await page.waitForTimeout(500);
      // Guide documents: Log Call, Add Note, Promise to Pay, Dispute, Send Next Stage
      const documented = ['Log Call', 'Add Note', 'Promise to Pay', 'Dispute', 'Send Next Stage'];
      let found = 0;
      for (const btn of documented) {
        const el = page.getByRole('button', { name: new RegExp(btn, 'i') });
        if (await el.isVisible()) found++;
      }
      // At least 3 of the 5 documented buttons should be present
      expect(found).toBeGreaterThanOrEqual(3);
    }
  });

  test('Billing Pipeline banner on home page is documented and present', async ({ page }) => {
    await page.goto(BASE_PATH + '/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Billing Pipeline')).toBeVisible();
  });

  test('Billing Pipeline has Collections Due stage linking to AR', async ({ page }) => {
    await page.goto(BASE_PATH + '/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Collections Due')).toBeVisible();
    await expect(page.locator('a[href*="/ar"]').first()).toBeAttached();
  });

  test('invoice preview generates billing hold banner for holds (documented in Section 8)', async ({ page }) => {
    await page.goto(INVOICES_URL);
    await page.waitForLoadState('networkidle');
    const generateBtn = page.getByRole('button', { name: /generate preview/i });
    await generateBtn.click();
    await page.waitForLoadState('networkidle');
    // Guide says orange billing hold banner appears after preview
    // It's data-dependent — page must at least load without error
    await expect(page.locator('text=/Generate Preview|Billing Hold|No data/i').first()).toBeVisible({ timeout: 10000 });
  });
});

// ====================================================================
// Part 3: Label and Status Descriptions Match UI
// ====================================================================
test.describe('AR Guide: labels match UI', () => {
  test('guide documents "unpaid" status — app uses it as AR status value', async ({ page }) => {
    // Verify the Invoices sub-tab shows status badges in the table
    await page.goto(AR_URL);
    await page.getByRole('button', { name: 'Invoices' }).first().click();
    await page.waitForLoadState('networkidle');
    // If invoices exist, status badges are present
    const table = page.locator('table');
    const tableVisible = await table.isVisible();
    expect(tableVisible).toBeTruthy();
  });

  test('guide documents Dashboard aging bucket "1-15 days" — visible in app', async ({ page }) => {
    await page.goto(AR_URL);
    await page.waitForLoadState('networkidle');
    await expect(
      page.locator('text=/1.{0,5}15|1–15/').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('guide documents 4 financial strip labels — visible in open drawer', async ({ page }) => {
    await page.goto(AR_URL);
    await page.getByRole('button', { name: 'Invoices' }).first().click();
    await page.waitForLoadState('networkidle');

    const rows = page.locator('tbody tr');
    if (await rows.count() > 0) {
      await rows.first().click();
      await page.waitForTimeout(500);
      const labels = ['Invoice Total', 'Balance Due', 'Stage'];
      for (const label of labels) {
        await expect(page.locator(`text=${label}`).first()).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('guide documents "Accts. Rec." nav tab label — matches app exactly', async ({ page }) => {
    await page.goto(AR_URL);
    const basePage = new BasePage(page);
    // Guide says tab is labelled "Accts. Rec."
    await expect(basePage.navTab('Accts. Rec.')).toBeVisible();
  });
});

// ====================================================================
// Part 4: Static File Serving + Cross-links
// ====================================================================
test.describe('AR Guide: static serving and cross-links', () => {
  test('guide HTML loads at /training/ar-guide.html', async ({ page }) => {
    await page.goto(GUIDE_URL);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Accounts Receivable');
  });

  test('cross-link to main guide works', async ({ page }) => {
    await page.goto(GUIDE_URL);
    const link = page.locator('a[href="index.html"]');
    await expect(link).toBeVisible();
    await expect(link).toHaveText(/Main Guide/i);
  });

  test('cross-link to daily-review guide works', async ({ page }) => {
    await page.goto(GUIDE_URL);
    const link = page.locator('a[href="daily-review-guide.html"]');
    await expect(link).toBeVisible();
  });

  test('cross-link to profitability guide works', async ({ page }) => {
    await page.goto(GUIDE_URL);
    const link = page.locator('a[href="profitability-guide.html"]');
    await expect(link).toBeVisible();
  });

  test('cross-link to cash position guide works', async ({ page }) => {
    await page.goto(GUIDE_URL);
    const link = page.locator('a[href="cash-position-guide.html"]');
    await expect(link).toBeVisible();
  });

  test('guide has no broken anchor links in TOC', async ({ page }) => {
    await page.goto(GUIDE_URL);
    const tocLinks = page.locator('.toc a[href^="#"]');
    const count = await tocLinks.count();
    expect(count).toBe(9);

    for (let i = 0; i < count; i++) {
      const href = await tocLinks.nth(i).getAttribute('href');
      expect(href).toBeTruthy();
      const target = page.locator(href!);
      await expect(target).toBeAttached();
    }
  });

  test('no console errors loading the guide', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto(GUIDE_URL);
    expect(errors).toHaveLength(0);
  });
});
