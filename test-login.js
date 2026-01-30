// Simple Playwright test script that can be run with: node test-login.js
const { chromium } = require('playwright');

(async () => {
  console.log('Starting browser...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen for console messages
  page.on('console', msg => console.log(`PAGE ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', error => console.log(`PAGE ERROR: ${error.message}`));

  console.log('Navigating to production site...');
  await page.goto('https://rdsweet1.github.io/mit-qb-frontend/');

  console.log('Waiting for page to load...');
  await page.waitForLoadState('networkidle');

  console.log('Taking screenshot...');
  await page.screenshot({ path: 'screenshot-main.png', fullPage: true });

  // Check for login button
  console.log('Looking for login button...');
  const loginButton = await page.$('button:has-text("Sign in with Microsoft")');

  if (loginButton) {
    console.log('✓ Login button found!');

    console.log('Clicking login button...');

    // Wait for popup
    const popupPromise = page.context().waitForEvent('page', { timeout: 10000 }).catch(() => null);

    await loginButton.click();

    console.log('Waiting for popup or redirect...');
    await page.waitForTimeout(3000);

    const popup = await popupPromise;
    if (popup) {
      console.log('✓ Popup opened!');
      console.log(`Popup URL: ${popup.url()}`);
      await popup.screenshot({ path: 'screenshot-popup.png' });
    } else {
      console.log('✗ No popup detected');
      await page.screenshot({ path: 'screenshot-after-click.png', fullPage: true });
    }
  } else {
    console.log('✗ Login button not found');
    const html = await page.content();
    console.log('Page HTML length:', html.length);
  }

  console.log('Waiting 5 seconds before closing...');
  await page.waitForTimeout(5000);

  await browser.close();
  console.log('Done!');
})().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
