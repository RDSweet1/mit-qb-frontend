import { Page, Locator } from '@playwright/test';
import { BasePage } from '../fixtures/base-page';

export class DashboardPage extends BasePage {
  readonly dashboardCards: Locator;

  constructor(page: Page) {
    super(page);
    this.dashboardCards = page.locator('[class*="rounded-xl"]').filter({ has: page.locator('h3') });
  }

  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  async verify() {
    await this.verifyAppShell();
  }
}
