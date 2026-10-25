// The browser server's starter for checks (tools/server-run.mjs): where it builds, and that it never opens data outside the harness folder.
import path from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { serverLayout, startServer } from '../../tools/server-run.mjs';

const roots = { repo: 'E:/r/wt', main: 'E:/r/main', work: path.resolve('E:/r/main/novira-data/work'), models: 'E:/r/main/novira-data/models' };

describe('server-run', () => {
  it('builds the server outside the repository and serves the checkout\'s harness build', () => {
    const layout = serverLayout({}, roots, 'E:/r/wt');
    expect(layout.target).toBe(path.resolve('E:/r/main/novira-data/work/server-target'));
    expect(layout.exe).toBe(path.join(layout.target, 'debug', 'novira-server.exe'));
    // The harness build in the main checkout's work folder, one per checkout; never frontend/dist (the user's app build).
    expect(path.dirname(layout.dist)).toBe(path.join(roots.work, 'e2e-build'));
    expect(path.basename(layout.dist)).toMatch(/^wt-[0-9a-f]{8}$/);
  });

  it('lets NOVIRA_SERVER_TARGET move the build', () => {
    expect(serverLayout({ NOVIRA_SERVER_TARGET: 'E:/t/x' }, roots, 'E:/r/wt').target).toBe(path.resolve('E:/t/x'));
  });

  it.each(['E:/r/main/novira-data', 'E:/r/main/novira-data/work', 'E:/elsewhere/data', 'E:/r/main/novira-data/work/../models'])('refuses the data folder %s', async (data) => {
    await expect(startServer({ data, roots })).rejects.toThrow(/refusing/);
  });
});
