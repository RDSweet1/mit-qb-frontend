/**
 * AR Guide Screenshot Capture
 *
 * Navigates to each relevant page/state and saves PNGs to
 * public/training/screenshots/  for embedding in ar-guide.html.
 *
 * Run:  npx playwright test tests/screenshots/capture-ar-screenshots.spec.ts --project=screenshots
 */
import { test, expect } from '../fixtures/test';
import path from 'path';

const BASE_PATH = '/mit-qb-frontend';
const OUT = path.resolve(__dirname, '../../public/training/screenshots');

function ss(name: string) {
  return path.join(OUT, name);
}

test.use({ viewport: { width: 1280, height: 800 } });

// ─── Home Dashboard: Billing Pipeline Banner ─────────────────────────────────
test('home-pipeline', async ({ page }) => {
  await page.goto(`http://localhost:3000${BASE_PATH}/`);
  await page.waitForLoadState('networkidle');

  // Capture just the banner area
  const banner = page.locator('text=Billing Pipeline').first();
  await expect(banner).toBeVisible({ timeout: 10000 });

  // Full page shot of home, then clip to top content
  await page.screenshot({
    path: ss('home-pipeline.png'),
    clip: { x: 0, y: 0, width: 1280, height: 500 },
  });
});

// ─── AR page: overview with sub-tabs visible ─────────────────────────────────
test('ar-page-overview', async ({ page }) => {
  await page.goto(`http://localhost:3000${BASE_PATH}/ar`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({
    path: ss('ar-page-overview.png'),
    clip: { x: 0, y: 0, width: 1280, height: 650 },
  });
});

// ─── AR Dashboard tab ────────────────────────────────────────────────────────
test('ar-dashboard-tab', async ({ page }) => {
  await page.goto(`http://localhost:3000${BASE_PATH}/ar`);
  await page.waitForLoadState('networkidle');
  // Dashboard is default — just take the shot
  await page.screenshot({
    path: ss('ar-dashboard.png'),
    clip: { x: 0, y: 130, width: 1280, height: 580 },
  });
});

// ─── AR Invoices tab ─────────────────────────────────────────────────────────
test('ar-invoices-tab', async ({ page }) => {
  await page.goto(`http://localhost:3000${BASE_PATH}/ar`);
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Invoices' }).first().click();
  await page.waitForLoadState('networkidle');
  await page.screenshot({
    path: ss('ar-invoices.png'),
    clip: { x: 0, y: 130, width: 1280, height: 580 },
  });
});

// ─── AR Queue tab ────────────────────────────────────────────────────────────
test('ar-queue-tab', async ({ page }) => {
  await page.goto(`http://localhost:3000${BASE_PATH}/ar`);
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Queue' }).first().click();
  await page.waitForLoadState('networkidle');
  await page.screenshot({
    path: ss('ar-queue.png'),
    clip: { x: 0, y: 130, width: 1280, height: 580 },
  });
});

// ─── AR Activity tab ─────────────────────────────────────────────────────────
test('ar-activity-tab', async ({ page }) => {
  await page.goto(`http://localhost:3000${BASE_PATH}/ar`);
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Activity' }).first().click();
  await page.waitForLoadState('networkidle');
  await page.screenshot({
    path: ss('ar-activity.png'),
    clip: { x: 0, y: 130, width: 1280, height: 580 },
  });
});

// ─── Invoice detail drawer (open on first row if any exist) ──────────────────
test('ar-detail-drawer', async ({ page }) => {
  await page.goto(`http://localhost:3000${BASE_PATH}/ar`);
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Invoices' }).first().click();
  await page.waitForLoadState('networkidle');

  const rows = page.locator('tbody tr');
  const count = await rows.count();
  if (count > 0) {
    await rows.first().click();
    await page.waitForTimeout(700);
    await page.screenshot({
      path: ss('ar-detail-drawer.png'),
      clip: { x: 0, y: 0, width: 1280, height: 800 },
    });
  } else {
    // No rows — take a shot of the empty state
    await page.screenshot({ path: ss('ar-detail-drawer.png') });
  }
});

// ─── Sync buttons strip ──────────────────────────────────────────────────────
test('ar-sync-buttons', async ({ page }) => {
  await page.goto(`http://localhost:3000${BASE_PATH}/ar`);
  await page.waitForLoadState('networkidle');

  const syncBtn = page.getByRole('button', { name: /sync from qb/i });
  await expect(syncBtn).toBeVisible();

  const box = await syncBtn.boundingBox();
  if (box) {
    await page.screenshot({
      path: ss('ar-sync-buttons.png'),
      clip: {
        x: Math.max(0, box.x - 20),
        y: Math.max(0, box.y - 20),
        width: 700,
        height: box.height + 40,
      },
    });
  }
});

// ─── Invoices page: billing hold banner ──────────────────────────────────────
test('invoices-billing-hold', async ({ page }) => {
  await page.goto(`http://localhost:3000${BASE_PATH}/invoices`);
  await page.waitForLoadState('networkidle');

  const generateBtn = page.getByRole('button', { name: /generate preview/i });
  if (await generateBtn.isVisible()) {
    await generateBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  }

  await page.screenshot({
    path: ss('invoices-billing-hold.png'),
    clip: { x: 0, y: 0, width: 1280, height: 600 },
  });
});
