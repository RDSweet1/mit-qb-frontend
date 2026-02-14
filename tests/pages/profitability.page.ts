import { Page, Locator } from '@playwright/test';
import { BasePage, BASE_PATH } from '../fixtures/base-page';

export class ProfitabilityPage extends BasePage {
  readonly tabs: Locator;

  constructor(page: Page) {
    super(page);
    this.tabs = page.getByRole('button').filter({ hasText: /trends|p&l|overhead/i });
  }

  async goto() {
    await this.page.goto(BASE_PATH + '/profitability');
    await this.page.waitForLoadState('networkidle');
  }

  async verify() {
    await this.verifyAppShell();
    await this.verifyPageHeader('Profitability');
    await this.verifyActiveNavTab('Profitability');
  }
}
