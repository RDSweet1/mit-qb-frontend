import { Page, Locator } from '@playwright/test';
import { BasePage, BASE_PATH } from '../fixtures/base-page';

export class TimeEntriesPage extends BasePage {
  readonly syncButton: Locator;
  readonly entriesTable: Locator;
  readonly statusBadges: Locator;

  constructor(page: Page) {
    super(page);
    this.syncButton = page.getByRole('button', { name: /sync/i });
    this.entriesTable = page.locator('table');
    this.statusBadges = page.locator('[data-testid="entry-status-badge"]');
  }

  async goto() {
    await this.page.goto(BASE_PATH + '/time-entries-enhanced');
    await this.page.waitForLoadState('networkidle');
  }

  async verify() {
    await this.verifyAppShell();
    await this.verifyPageHeader('Time Entries');
    await this.verifyActiveNavTab('Time Entries');
  }
}
