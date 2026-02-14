import { Page, Locator } from '@playwright/test';
import { BasePage } from '../fixtures/base-page';

export class AdminPage extends BasePage {
  readonly usersTable: Locator;

  constructor(page: Page) {
    super(page);
    this.usersTable = page.locator('table');
  }

  async goto() {
    await this.page.goto('/admin/users');
    await this.page.waitForLoadState('networkidle');
  }

  async verify() {
    await this.verifyAppShell();
    await this.verifyPageHeader('User Management');
    await this.verifyActiveNavTab('Admin');
  }
}
