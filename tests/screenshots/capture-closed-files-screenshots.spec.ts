/**
 * Closed Files Guide Screenshot Capture
 *
 * Navigates to the Invoices page and captures screenshots of the
 * Closed Files section for embedding in closed-files.html training guide.
 *
 * Run:  npx playwright test tests/screenshots/capture-closed-files-screenshots.spec.ts --project=screenshots
 */
import { test, expect } from '../fixtures/test';
import path from 'path';

const BASE_PATH = '/mit-qb-frontend';
const OUT = path.resolve(__dirname, '../../public/training/screenshots');

function ss(name: string) {
  return path.join(OUT, name);
}

test.use({ viewport: { width: 1280, height: 800 } });

// ─── Invoices page: Closed Files section collapsed ──────────────────────────
test('closed-files-collapsed', async ({ page }) => {
  await page.goto(`http://localhost:3000${BASE_PATH}/invoices`);
  await page.waitForLoadState('networkidle');

  // Find the Closed Files button
  const closedBtn = page.locator('button', { hasText: 'Closed Files' });
  await expect(closedBtn).toBeVisible({ timeout: 10000 });

  // Get the bounding box of the parent container
  const container = closedBtn.locator('..');
  const box = await container.boundingBox();
  if (box) {
    await page.screenshot({
      path: ss('closed-files-collapsed.png'),
      clip: {
        x: Math.max(0, box.x - 20),
        y: Math.max(0, box.y - 20),
        width: Math.min(1280, box.width + 40),
        height: box.height + 40,
      },
    });
  } else {
    await page.screenshot({ path: ss('closed-files-collapsed.png') });
  }
});

// ─── Invoices page: Closed Files section expanded ───────────────────────────
test('closed-files-expanded', async ({ page }) => {
  await page.goto(`http://localhost:3000${BASE_PATH}/invoices`);
  await page.waitForLoadState('networkidle');

  // Expand the Closed Files section
  const closedBtn = page.locator('button', { hasText: 'Closed Files' });
  await expect(closedBtn).toBeVisible({ timeout: 10000 });

  // Scroll the section into view first
  await closedBtn.scrollIntoViewIfNeeded();
  await closedBtn.click();
  await page.waitForTimeout(500);

  // Capture the expanded section — get the border container (div.mb-6.border)
  const section = closedBtn.locator('..').locator('..');
  await section.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  const box = await section.boundingBox();
  if (box) {
    await page.screenshot({
      path: ss('closed-files-expanded.png'),
      clip: {
        x: Math.max(0, box.x - 20),
        y: Math.max(0, box.y - 20),
        width: Math.min(1280, box.width + 40),
        height: box.height + 40,
      },
    });
  } else {
    await page.screenshot({ path: ss('closed-files-expanded.png') });
  }
});

// ─── Invoices page: Close a file dropdown ───────────────────────────────────
test('closed-files-dropdown', async ({ page }) => {
  await page.goto(`http://localhost:3000${BASE_PATH}/invoices`);
  await page.waitForLoadState('networkidle');

  // Expand the Closed Files section
  const closedBtn = page.locator('button', { hasText: 'Closed Files' });
  await expect(closedBtn).toBeVisible({ timeout: 10000 });
  await closedBtn.scrollIntoViewIfNeeded();
  await closedBtn.click();
  await page.waitForTimeout(500);

  // Find the "Close a file..." dropdown by its placeholder option
  const dropdown = page.locator('select:has(option[value=""])').last();
  await dropdown.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  if (await dropdown.isVisible()) {
    await dropdown.focus();
    const box = await dropdown.boundingBox();
    if (box) {
      await page.screenshot({
        path: ss('closed-files-dropdown.png'),
        clip: {
          x: Math.max(0, box.x - 20),
          y: Math.max(0, box.y - 40),
          width: Math.min(1280, box.width + 40),
          height: box.height + 80,
        },
      });
    } else {
      await page.screenshot({ path: ss('closed-files-dropdown.png') });
    }
  } else {
    // Fallback: screenshot the whole expanded section
    const section = closedBtn.locator('..').locator('..');
    await section.scrollIntoViewIfNeeded();
    const sbox = await section.boundingBox();
    if (sbox) {
      await page.screenshot({
        path: ss('closed-files-dropdown.png'),
        clip: {
          x: Math.max(0, sbox.x - 20),
          y: Math.max(0, sbox.y - 20),
          width: Math.min(1280, sbox.width + 40),
          height: sbox.height + 40,
        },
      });
    } else {
      await page.screenshot({ path: ss('closed-files-dropdown.png') });
    }
  }
});

// ─── Invoices page: Full page context showing where Closed Files lives ──────
test('closed-files-full-page', async ({ page }) => {
  await page.goto(`http://localhost:3000${BASE_PATH}/invoices`);
  await page.waitForLoadState('networkidle');

  // Expand for context
  const closedBtn = page.locator('button', { hasText: 'Closed Files' });
  await expect(closedBtn).toBeVisible({ timeout: 10000 });
  await closedBtn.click();
  await page.waitForTimeout(500);

  // Scroll so Closed Files section is visible in the viewport
  await closedBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  // Full page shot showing navigation context + expanded section
  await page.screenshot({
    path: ss('closed-files-full-page.png'),
    fullPage: true,
  });
});

// ─── Time Entries: [CLOSED] prefix in customer dropdown ─────────────────────
test('closed-files-time-entries-dropdown', async ({ page }) => {
  await page.goto(`http://localhost:3000${BASE_PATH}/time-entries-enhanced`);
  await page.waitForLoadState('networkidle');

  // Find the Customer dropdown
  const customerSelect = page.locator('select').filter({ hasText: 'All Customers' }).first();
  await expect(customerSelect).toBeVisible({ timeout: 10000 });

  // Take a screenshot showing the dropdown area
  const box = await customerSelect.boundingBox();
  if (box) {
    await page.screenshot({
      path: ss('closed-files-te-dropdown.png'),
      clip: {
        x: Math.max(0, box.x - 20),
        y: Math.max(0, box.y - 30),
        width: Math.min(500, box.width + 40),
        height: box.height + 60,
      },
    });
  }
});
