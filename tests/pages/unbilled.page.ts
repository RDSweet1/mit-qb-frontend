import { Page, Locator } from '@playwright/test';
import { BasePage } from '../fixtures/base-page';

export class UnbilledPage extends BasePage {
  readonly table: Locator;

  constructor(page: Page) {
    super(page);
    this.table = page.locator('table');
  }

  async goto() {
    await this.page.goto('/analytics/unbilled-time');
    await this.page.waitForLoadState('networkidle');
  }

  async verify() {
    await this.verifyAppShell();
    await this.verifyPageHeader('Unbilled Time');
    await this.verifyActiveNavTab('Unbilled');
  }
}
