import { afterEach, describe, expect, it, vi } from 'vitest';
import { agentGuide } from './agentGuide';
import { agentEditor, registerAgentEditor } from './agentRegistry';
import { MEDIA_KINDS, TABS } from './ui';

describe('what the assistant is told about the app', () => {
  const guide = agentGuide();

  it('has an entry for every tab and every kind of media, so a new one cannot be forgotten', () => {
    const ids = guide.map((g) => g.id);
    for (const tab of TABS) expect(ids).toContain(`tab.${tab}`);
    for (const kind of MEDIA_KINDS) expect(ids).toContain(`media.${kind}`);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives each entry the name the screen shows and a sentence about it', () => {
    for (const g of guide) {
      expect(g.name.trim(), g.id).not.toBe('');
      expect(g.about.length, g.id).toBeGreaterThan(40);
    }
    expect(guide.find((g) => g.id === 'tab.extensions')?.about).toContain('restart');
  });

  it('stays small enough to send with every message', () => {
    expect(JSON.stringify(guide).length).toBeLessThan(9000);
  });
});

describe('screens the app build hides', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('are neither described to the assistant nor editable by it', () => {
    registerAgentEditor('comic', { context: () => ({}), apply: () => true, snapshot: () => null, restore: () => {} });
    vi.stubEnv('MODE', 'production');
    const ids = agentGuide().map((g) => g.id);
    expect(ids).not.toContain('tab.comic');
    expect(ids).not.toContain('media.video');
    expect(ids).toContain('tab.canvas');
    expect(agentEditor('comic')).toBeUndefined();
    vi.stubEnv('MODE', 'harness');
    expect(agentEditor('comic')).toBeDefined();
  });
});
