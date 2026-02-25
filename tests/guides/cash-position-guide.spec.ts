/**
 * Cash Position Guide — Validation Tests
 *
 * These tests verify that the HTML training guide at
 * /training/cash-position-guide.html accurately describes the app.
 *
 * Test strategy:
 *   Part 1: Guide renders correctly (HTML structure, sections, links)
 *   Part 2: Guide steps match real app behavior (follow each documented step)
 *   Part 3: Guide's data descriptions match actual UI labels
 *   Part 4: Guide's FAQ answers are testable (verify the described behavior)
 *
 * If the app changes and these tests fail, it means the guide is now
 * out of date and must be updated to match the new behavior.
 */
import { test, expect } from '../fixtures/test';
import { BasePage, BASE_PATH } from '../fixtures/base-page';

const GUIDE_URL = `${BASE_PATH}/training/cash-position-guide.html`;
const CASH_POSITION_URL = `${BASE_PATH}/profitability`;

// ==================================================================
// Part 1: Guide HTML Renders Correctly
// ==================================================================

test.describe('Guide: HTML structure', () => {
  test('guide page loads with correct title', async ({ page }) => {
    await page.goto(GUIDE_URL);
    await expect(page).toHaveTitle(/Cash Position.*Net Financial Position/);
  });

  test('guide has sticky header with correct heading', async ({ page }) => {
    await page.goto(GUIDE_URL);
    await expect(page.locator('.header h1')).toContainText('Cash Position');
    await expect(page.locator('.header p')).toContainText('Training Guide');
  });

  test('table of contents has all 8 sections', async ({ page }) => {
    await page.goto(GUIDE_URL);
    const tocLinks = page.locator('.toc a');
    await expect(tocLinks).toHaveCount(8);
  });

  test('all 8 sections exist with correct IDs', async ({ page }) => {
    await page.goto(GUIDE_URL);
    const sectionIds = [
      'overview', 'getting-live-balances', 'net-position-cards',
      'account-balances', 'cc-expenses', 'upcoming-bills',
      'existing-sections', 'faq',
    ];
    for (const id of sectionIds) {
      await expect(page.locator(`#${id}`)).toBeAttached();
    }
  });

  test('TOC links navigate to correct sections', async ({ page }) => {
    await page.goto(GUIDE_URL);

    // Click second TOC link
    await page.locator('.toc a').nth(1).click();

    // Target section should now be open
    await expect(page.locator('#getting-live-balances')).toHaveClass(/open/);
  });

  test('section toggle works (click to expand/collapse)', async ({ page }) => {
    await page.goto(GUIDE_URL);

    // FAQ section should be collapsed by default
    const faqSection = page.locator('#faq');
    await expect(faqSection).not.toHaveClass(/open/);

    // Click to open
    await faqSection.locator('.section-header').click();
    await expect(faqSection).toHaveClass(/open/);

    // Click to close
    await faqSection.locator('.section-header').click();
    await expect(faqSection).not.toHaveClass(/open/);
  });

  test('first section (overview) is open by default', async ({ page }) => {
    await page.goto(GUIDE_URL);
    await expect(page.locator('#overview')).toHaveClass(/open/);
  });

  test('guide has back link to main training guide', async ({ page }) => {
    await page.goto(GUIDE_URL);
    await expect(page.locator('a[href="index.html"]')).toBeVisible();
  });

  test('formula box shows correct formula', async ({ page }) => {
    await page.goto(GUIDE_URL);
    const formula = page.locator('.formula-box');
    await expect(formula).toContainText('Cash on Hand');
    await expect(formula).toContainText('CC Debt');
    await expect(formula).toContainText('Accounts Receivable');
    await expect(formula).toContainText('Accounts Payable');
    await expect(formula).toContainText('Net Position');
  });
});

// ==================================================================
// Part 2: Guide Steps Match Real App Behavior
// ==================================================================

test.describe('Guide: Section 1 — Navigation steps match app', () => {
  test('Step 1: Profitability tab exists in nav', async ({ page }) => {
    // Guide says: "Click Profitability in the top navigation bar"
    await page.goto(CASH_POSITION_URL);
    await page.waitForLoadState('networkidle');

    const basePage = new BasePage(page);
    await expect(basePage.navTab('Profitability')).toBeVisible();
  });

  test('Step 2: Cash Position tab exists on profitability page', async ({ page }) => {
    // Guide says: "Click the Cash Position tab"
    await page.goto(CASH_POSITION_URL);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: /cash position/i })).toBeVisible();
  });

  test('Step 3: Refresh Live Balances button exists', async ({ page }) => {
    // Guide says: "Click Refresh Live Balances (the purple button)"
    await page.goto(CASH_POSITION_URL);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: /refresh live balances/i })).toBeVisible();
  });
});

test.describe('Guide: Section 2 — Two sync buttons described correctly', () => {
  test('guide says purple button = "Refresh Live Balances" — verify it exists', async ({ page }) => {
    await page.goto(CASH_POSITION_URL);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    const refreshBtn = page.getByRole('button', { name: /refresh live balances/i });
    await expect(refreshBtn).toBeVisible();
    // Verify it's purple-themed (bg-purple-600)
    await expect(refreshBtn).toHaveClass(/bg-purple/);
  });

  test('guide says blue button = "Sync Payments" — verify it exists', async ({ page }) => {
    await page.goto(CASH_POSITION_URL);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    const syncBtn = page.getByRole('button', { name: /sync payments/i });
    await expect(syncBtn).toBeVisible();
    // Verify it's blue-themed (bg-blue-600)
    await expect(syncBtn).toHaveClass(/bg-blue/);
  });

  test('guide says net position sections only appear after clicking Refresh', async ({ page }) => {
    await page.goto(CASH_POSITION_URL);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    // Before clicking refresh — hero cards should NOT be visible
    await expect(page.locator('span', { hasText: 'Cash on Hand' })).not.toBeVisible();
    await expect(page.locator('span', { hasText: 'Net Position' })).not.toBeVisible();
  });
});

test.describe('Guide: Section 3 — Net Position cards described correctly', () => {
  test('guide lists 5 cards — verify all 5 appear after refresh', async ({ page }) => {
    await page.goto(CASH_POSITION_URL);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /refresh live balances/i }).click();
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 120000 });

    // Guide documents these exact 5 cards
    const cardLabels = ['Cash on Hand', 'CC Outstanding', 'Receivables (A/R)', 'Payables (A/P)', 'Net Position'];
    for (const label of cardLabels) {
      await expect(page.locator('span', { hasText: label })).toBeVisible();
    }
  });

  test('guide says Net Position card shows formula subtitle', async ({ page }) => {
    await page.goto(CASH_POSITION_URL);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /refresh live balances/i }).click();
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 120000 });

    // Guide says: formula shown underneath: "Cash − CC Debt + A/R − A/P"
    const formulaSubtitle = page.locator('p', { hasText: /CC Debt.*A\/R.*A\/P/ });
    await expect(formulaSubtitle).toBeVisible();
  });

  test('guide says A/R and A/P cards show item counts', async ({ page }) => {
    await page.goto(CASH_POSITION_URL);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /refresh live balances/i }).click();
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 120000 });

    // Guide says: cards show count (e.g. "37 invoices" or "2 bills")
    const invoiceCount = page.locator('p', { hasText: /\d+ invoice/ });
    const billCount = page.locator('p', { hasText: /\d+ bill/ });
    await expect(invoiceCount).toBeVisible();
    await expect(billCount).toBeVisible();
  });
});

test.describe('Guide: Section 4 — Account Balances described correctly', () => {
  test('guide says Account Balances section is collapsible', async ({ page }) => {
    await page.goto(CASH_POSITION_URL);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /refresh live balances/i }).click();
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 120000 });

    // Guide says: "Click the Account Balances header to collapse or expand"
    const header = page.locator('button', { hasText: 'Account Balances' });
    await expect(header).toBeVisible();

    // Should be expandable by default — collapse it
    await header.click();

    // Content should now be hidden
    await expect(page.locator('text=Total Bank')).not.toBeVisible();

    // Re-expand
    await header.click();
    await expect(page.locator('text=Total Bank')).toBeVisible();
  });

  test('guide says Bank and Credit Card type badges appear', async ({ page }) => {
    await page.goto(CASH_POSITION_URL);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /refresh live balances/i }).click();
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 120000 });

    // Guide says: Bank badge (blue) and Credit Card badge (purple)
    await expect(page.locator('span.rounded-full', { hasText: 'Bank' }).first()).toBeVisible();
    // There may be CC accounts
    const ccBadges = page.locator('span.rounded-full', { hasText: 'Credit Card' });
    const ccCount = await ccBadges.count();
    // If there are CC accounts, they should have purple background
    if (ccCount > 0) {
      await expect(ccBadges.first()).toHaveClass(/bg-purple/);
    }
  });

  test('guide says Total Bank and Total CC Debt rows appear at bottom', async ({ page }) => {
    await page.goto(CASH_POSITION_URL);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /refresh live balances/i }).click();
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 120000 });

    await expect(page.locator('text=Total Bank')).toBeVisible();
    await expect(page.locator('text=Total CC Debt')).toBeVisible();
  });
});

test.describe('Guide: Section 5 — CC Expense Breakdown described correctly', () => {
  test('guide says CC Expense Breakdown is collapsible section', async ({ page }) => {
    await page.goto(CASH_POSITION_URL);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /refresh live balances/i }).click();
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 120000 });

    const ccHeader = page.locator('button', { hasText: 'CC Expense Breakdown' });
    await expect(ccHeader).toBeVisible();
  });

  test('guide says empty state message is "Run Daily Review Sync..."', async ({ page }) => {
    await page.goto(CASH_POSITION_URL);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /refresh live balances/i }).click();
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 120000 });

    // Expand CC Breakdown
    await page.locator('button', { hasText: 'CC Expense Breakdown' }).click();

    // Guide says the empty state says exactly: "Run Daily Review Sync to populate CC expense data."
    // Either we see category data OR we see this message
    const categoryData = page.locator('th', { hasText: 'Category' });
    const emptyMsg = page.locator('text=Run Daily Review Sync to populate CC expense data.');
    await expect(categoryData.first().or(emptyMsg)).toBeVisible({ timeout: 5000 });
  });

  test('guide says columns are Category, Amount, Txns', async ({ page }) => {
    await page.goto(CASH_POSITION_URL);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /refresh live balances/i }).click();
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 120000 });

    await page.locator('button', { hasText: 'CC Expense Breakdown' }).click();

    // If data exists, verify column headers match guide
    const hasCategoryHeader = await page.locator('th', { hasText: 'Category' }).isVisible().catch(() => false);
    if (hasCategoryHeader) {
      await expect(page.locator('th', { hasText: 'Amount' })).toBeVisible();
      await expect(page.locator('th', { hasText: 'Txns' })).toBeVisible();
    }
  });
});

test.describe('Guide: Section 6 — Upcoming Bills described correctly', () => {
  test('guide says A/P section header is "Upcoming Bills / A/P"', async ({ page }) => {
    await page.goto(CASH_POSITION_URL);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /refresh live balances/i }).click();
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 120000 });

    await expect(page.locator('button', { hasText: 'Upcoming Bills / A/P' })).toBeVisible();
  });

  test('guide says columns are Vendor, Due Date, Total, Balance, Status, Days', async ({ page }) => {
    await page.goto(CASH_POSITION_URL);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /refresh live balances/i }).click();
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 120000 });

    await page.locator('button', { hasText: 'Upcoming Bills / A/P' }).click();

    // Scope to the A/P section to avoid matching A/R Aging's "Balance" header
    const apSection = page.locator('button', { hasText: 'Upcoming Bills / A/P' }).locator('..');
    const hasData = await apSection.locator('th', { hasText: 'Vendor' }).isVisible().catch(() => false);
    if (hasData) {
      await expect(apSection.locator('th', { hasText: 'Vendor' })).toBeVisible();
      await expect(apSection.locator('th', { hasText: 'Due Date' })).toBeVisible();
      await expect(apSection.locator('th', { hasText: 'Total' })).toBeVisible();
      await expect(apSection.locator('th', { hasText: 'Balance' })).toBeVisible();
      await expect(apSection.locator('th', { hasText: 'Status' })).toBeVisible();
      await expect(apSection.locator('th', { hasText: 'Days' })).toBeVisible();
    }
  });

  test('guide says status badges are Overdue/Due Soon/Current', async ({ page }) => {
    await page.goto(CASH_POSITION_URL);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /refresh live balances/i }).click();
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 120000 });

    await page.locator('button', { hasText: 'Upcoming Bills / A/P' }).click();

    // If there are bills, check that badges match guide's documented values
    const badges = page.locator('span.rounded-full').filter({ hasText: /Overdue|Due Soon|Current/ });
    const count = await badges.count();
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const text = await badges.nth(i).textContent();
        expect(['Overdue', 'Due Soon', 'Current']).toContain(text?.trim());
      }
    }
  });

  test('guide says Total A/P row appears at bottom', async ({ page }) => {
    await page.goto(CASH_POSITION_URL);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /refresh live balances/i }).click();
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 120000 });

    await page.locator('button', { hasText: 'Upcoming Bills / A/P' }).click();

    const hasData = await page.locator('th', { hasText: 'Vendor' }).isVisible().catch(() => false);
    if (hasData) {
      await expect(page.locator('text=Total A/P')).toBeVisible();
    }
  });
});

test.describe('Guide: Section 7 — Existing sections still present', () => {
  test('guide says YTD Summary cards exist — verify all 4', async ({ page }) => {
    await page.goto(CASH_POSITION_URL);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    // Guide documents: YTD Billed, YTD Received, Collection Rate, Outstanding A/R
    await expect(page.locator('span', { hasText: 'YTD Billed' })).toBeVisible();
    await expect(page.locator('span', { hasText: 'YTD Received' })).toBeVisible();
    await expect(page.locator('span', { hasText: 'Collection Rate' })).toBeVisible();
    await expect(page.locator('span', { hasText: 'Outstanding A/R' })).toBeVisible();
  });

  test('guide says A/R Aging section exists', async ({ page }) => {
    await page.goto(CASH_POSITION_URL);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('button', { hasText: 'A/R Aging' })).toBeVisible();
  });

  test('guide says weekly cash detail table exists (or empty state)', async ({ page }) => {
    await page.goto(CASH_POSITION_URL);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    const table = page.locator('text=Weekly Cash Detail');
    const empty = page.locator('text=No Cash Data');
    await expect(table.or(empty)).toBeVisible({ timeout: 10000 });
  });
});

// ==================================================================
// Part 3: Guide FAQ Claims Are Accurate
// ==================================================================

test.describe('Guide: FAQ claims are accurate', () => {
  test('FAQ: "net position sections only appear after clicking Refresh"', async ({ page }) => {
    await page.goto(CASH_POSITION_URL);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    // Before refresh — should NOT see net position cards
    await expect(page.locator('span', { hasText: 'Cash on Hand' })).not.toBeVisible();
    await expect(page.locator('span', { hasText: 'Net Position' })).not.toBeVisible();

    // After refresh — should see them
    await page.getByRole('button', { name: /refresh live balances/i }).click();
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 120000 });

    await expect(page.locator('span', { hasText: 'Cash on Hand' })).toBeVisible();
    await expect(page.locator('span', { hasText: 'Net Position' })).toBeVisible();
  });

  test('FAQ: timestamp shown after refresh', async ({ page }) => {
    await page.goto(CASH_POSITION_URL);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /refresh live balances/i }).click();
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 120000 });

    // Guide says: "a timestamp appears below the cards showing when the data was fetched"
    await expect(page.locator('text=Live balances as of')).toBeVisible();
  });

  test('no console errors during guide walkthrough', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    // Do the full guide walkthrough
    await page.goto(CASH_POSITION_URL);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /cash position/i }).click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /refresh live balances/i }).click();
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 120000 });

    // Expand collapsible sections
    const ccHeader = page.locator('button', { hasText: 'CC Expense Breakdown' });
    if (await ccHeader.isVisible()) await ccHeader.click();

    const apHeader = page.locator('button', { hasText: 'Upcoming Bills / A/P' });
    if (await apHeader.isVisible()) await apHeader.click();

    await page.waitForTimeout(2000);
    expect(errors).toHaveLength(0);
  });
});

// ==================================================================
// Part 4: Guide Renders on Production (static file serving)
// ==================================================================

test.describe('Guide: accessible from app', () => {
  test('guide HTML loads from /training/cash-position-guide.html', async ({ page }) => {
    const res = await page.goto(GUIDE_URL);
    expect(res?.status()).toBe(200);
  });

  test('main training index loads from /training/', async ({ page }) => {
    const res = await page.goto(`${BASE_PATH}/training/index.html`);
    expect(res?.status()).toBe(200);
  });
});
