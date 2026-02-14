import { Page, Locator } from '@playwright/test';
import { BasePage } from '../fixtures/base-page';

export class ReportsPage extends BasePage {
  readonly weekSelector: Locator;
  readonly reportTable: Locator;

  constructor(page: Page) {
    super(page);
    this.weekSelector = page.locator('select').first();
    this.reportTable = page.locator('table');
  }

  async goto() {
    await this.page.goto('/reports');
    await this.page.waitForLoadState('networkidle');
  }

  async verify() {
    await this.verifyAppShell();
    await this.verifyPageHeader('Weekly Reports');
    await this.verifyActiveNavTab('Reports');
  }
}
