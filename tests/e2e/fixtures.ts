import { test as base, expect } from '@playwright/test';
/** Tests also create explicit mobile/master contexts; release them on assertion failures. */
export const test = base.extend<{ contextCleanup: void }>({
  contextCleanup: [async ({ browser }, use) => {
    try { await use(); }
    finally { await Promise.all(browser.contexts().map(context => context.close().catch(() => {}))); }
  }, { auto: true }],
});
export { expect };
export type { Page } from '@playwright/test';
