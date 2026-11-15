import { test as base, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
export const test = base.extend<{ isolatedServer: void; contextCleanup: void }>({
  isolatedServer: [async ({}, use, info) => {
    let occupied = false;
    try { occupied = (await fetch('http://127.0.0.1:4179/health', { signal: AbortSignal.timeout(500) })).ok; } catch {}
    if (occupied) throw new Error('Port 4179 is already in use; stop the previous test host.');
    const host = spawn(process.execPath, ['--import', './apps/server/node_modules/tsx/dist/loader.mjs', 'apps/server/scripts/board-e2e-host.ts'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let log = ''; host.stdout.on('data', data => log += data); host.stderr.on('data', data => log += data);
    try {
      let ready = false;
      for (let i = 0; i < 120; i++) {
        if (host.exitCode !== null) throw new Error(`Test host exited: ${log}`);
        try { ready = (await fetch('http://127.0.0.1:4179/health')).ok; } catch {}
        if (ready) break;
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      if (!ready) throw new Error(`Test host did not become ready: ${log}`);
      await use();
    } finally {
      if (info.status !== info.expectedStatus) await info.attach('host.log', { body: log, contentType: 'text/plain' });
      if (host.exitCode === null) {
        const exited = once(host, 'exit'); host.kill('SIGTERM');
        const force = setTimeout(() => host.kill('SIGKILL'), 3000);
        await exited; clearTimeout(force);
      }
    }
  }, { auto: true, timeout: 35_000 }],
  contextCleanup: [async ({ browser, isolatedServer }, use) => {
    void isolatedServer;
    try { await use(); }
    finally { await Promise.all(browser.contexts().map(context => context.close().catch(() => {}))); }
  }, { auto: true }],
});
export { expect };
export type { Page } from '@playwright/test';
