import { Page, Locator } from '@playwright/test';
import { BasePage, BASE_PATH } from '../fixtures/base-page';

export class DailyReviewPage extends BasePage {
  readonly syncButton: Locator;
  readonly transactionTable: Locator;
  readonly dateFilter: Locator;

  constructor(page: Page) {
    super(page);
    this.syncButton = page.getByRole('button', { name: /sync/i });
    this.transactionTable = page.locator('table');
    this.dateFilter = page.locator('input[type="date"]').first();
  }

  async goto() {
    await this.page.goto(BASE_PATH + '/daily-review');
    await this.page.waitForLoadState('networkidle');
  }

  async verify() {
    await this.verifyAppShell();
    await this.verifyPageHeader('Daily Review');
    await this.verifyActiveNavTab('Daily Review');
  }
}
