import { Page, Locator } from '@playwright/test';
import { BasePage, BASE_PATH } from '../fixtures/base-page';

export class AdminPage extends BasePage {
  readonly usersTable: Locator;

  constructor(page: Page) {
    super(page);
    this.usersTable = page.locator('table');
  }

  async goto() {
    await this.page.goto(BASE_PATH + '/admin');
    await this.page.waitForLoadState('networkidle');
  }

  async verify() {
    await this.verifyAppShell();
    await this.verifyPageHeader('Administration');
    await this.verifyActiveNavTab('Admin');
  }
}
