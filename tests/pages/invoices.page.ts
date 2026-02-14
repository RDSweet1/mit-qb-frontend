import { Page, Locator } from '@playwright/test';
import { BasePage, BASE_PATH } from '../fixtures/base-page';

export class InvoicesPage extends BasePage {
  readonly monthSelector: Locator;

  constructor(page: Page) {
    super(page);
    this.monthSelector = page.getByLabel('Select Billing Month');
  }

  async goto() {
    await this.page.goto(BASE_PATH + '/invoices');
    await this.page.waitForLoadState('networkidle');
  }

  async verify() {
    await this.verifyAppShell();
    await this.verifyPageHeader('Monthly Invoices');
    await this.verifyActiveNavTab('Invoices');
  }
}
