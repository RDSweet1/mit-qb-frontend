import { Page, Locator } from '@playwright/test';
import { BasePage } from '../fixtures/base-page';

export class SettingsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.page.goto('/settings');
    await this.page.waitForLoadState('networkidle');
  }

  async verify() {
    await this.verifyAppShell();
    await this.verifyPageHeader('Settings');
    await this.verifyActiveNavTab('Settings');
  }
}
