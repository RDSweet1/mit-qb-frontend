import { Page, Locator } from '@playwright/test';
import { BasePage, BASE_PATH } from '../fixtures/base-page';

export class SettingsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.page.goto(BASE_PATH + '/settings');
    await this.page.waitForLoadState('networkidle');
  }

  async verify() {
    await this.verifyAppShell();
    await this.verifyPageHeader('Settings');
    await this.verifyActiveNavTab('Settings');
  }
}
