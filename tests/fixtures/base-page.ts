import { Page, Locator, expect } from '@playwright/test';

export class BasePage {
  readonly page: Page;
  readonly appShell: Locator;
  readonly appHeader: Locator;
  readonly appNav: Locator;
  readonly pageHeader: Locator;
  readonly pageTitle: Locator;
  readonly pageSubtitle: Locator;
  readonly pageActions: Locator;
  readonly signOutButton: Locator;
  readonly userName: Locator;

  constructor(page: Page) {
    this.page = page;
    this.appShell = page.locator('[data-testid="app-shell"]');
    this.appHeader = page.locator('[data-testid="app-header"]');
    this.appNav = page.locator('[data-testid="app-nav"]');
    this.pageHeader = page.locator('[data-testid="page-header"]');
    this.pageTitle = page.locator('[data-testid="page-title"]');
    this.pageSubtitle = page.locator('[data-testid="page-subtitle"]');
    this.pageActions = page.locator('[data-testid="page-actions"]');
    this.signOutButton = page.locator('[data-testid="sign-out-button"]');
    this.userName = page.locator('[data-testid="user-name"]');
  }

  navTab(name: string): Locator {
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    return this.page.locator(`[data-testid="nav-tab-${slug}"]`);
  }

  async verifyAppShell() {
    await expect(this.appShell).toBeVisible();
    await expect(this.appNav).toBeVisible();
    await expect(this.appHeader).toBeVisible();
  }

  async verifyPageHeader(title: string, subtitle?: string) {
    await expect(this.pageTitle).toHaveText(title);
    if (subtitle) {
      await expect(this.pageSubtitle).toHaveText(subtitle);
    }
  }

  async verifyActiveNavTab(name: string) {
    const tab = this.navTab(name);
    await expect(tab).toHaveClass(/border-blue-600/);
  }
}
