import { Page, Locator } from '@playwright/test';
import { BasePage, BASE_PATH } from '../fixtures/base-page';

export class OverheadPage extends BasePage {
  readonly vendorTable: Locator;

  constructor(page: Page) {
    super(page);
    this.vendorTable = page.locator('table');
  }

  async goto() {
    await this.page.goto(BASE_PATH + '/overhead');
    await this.page.waitForLoadState('networkidle');
  }

  async verify() {
    await this.verifyAppShell();
    await this.verifyPageHeader('Overhead Management');
    await this.verifyActiveNavTab('Overhead');
  }
}
