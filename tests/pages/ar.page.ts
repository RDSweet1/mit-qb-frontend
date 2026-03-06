import { Page, Locator } from '@playwright/test';
import { BasePage, BASE_PATH } from '../fixtures/base-page';

export class ARPage extends BasePage {
  readonly syncQBButton: Locator;
  readonly syncPaymentsButton: Locator;
  readonly syncEmailsButton: Locator;
  readonly invoiceTable: Locator;

  constructor(page: Page) {
    super(page);
    this.syncQBButton = page.getByRole('button', { name: /sync from qb/i });
    this.syncPaymentsButton = page.getByRole('button', { name: /sync payments/i });
    this.syncEmailsButton = page.getByRole('button', { name: /sync emails/i });
    this.invoiceTable = page.locator('table');
  }

  async goto() {
    await this.page.goto(BASE_PATH + '/ar');
    await this.page.waitForLoadState('networkidle');
  }

  async verify() {
    await this.verifyAppShell();
    await this.verifyPageHeader('Accounts Receivable');
    await this.verifyActiveNavTab('Accts. Rec.');
  }
}
