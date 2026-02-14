import { Page, Locator } from '@playwright/test';
import { BasePage, BASE_PATH } from '../fixtures/base-page';

export class ClarificationsPage extends BasePage {
  readonly filterButtons: Locator;

  constructor(page: Page) {
    super(page);
    this.filterButtons = page.getByRole('button').filter({ hasText: /all|pending|responded|cleared/i });
  }

  async goto() {
    await this.page.goto(BASE_PATH + '/internal-review');
    await this.page.waitForLoadState('networkidle');
  }

  async verify() {
    await this.verifyAppShell();
    await this.verifyPageHeader('Internal Clarifications');
    await this.verifyActiveNavTab('Clarifications');
  }
}
