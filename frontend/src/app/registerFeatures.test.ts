// @vitest-environment jsdom
// Every screen gets what it needs at start-up: a screen that makes something has an Invoke builder, a screen the assistant
// can change has an editor. The tables are typed over every screen, so a new tab or kind of media does not compile until
// it says whether it needs one; a screen that does not gives the reason.
import { describe, expect, it } from 'vitest';
import { agentEditor } from '@/state/agentRegistry';
import { EDIT_SCREENS } from '@/state/agentSessions';
import { hasInvokeBuilder, type BuilderKey } from '@/state/invoke';
import { registerFeatures } from './registerFeatures';

registerFeatures();

/** `true` for a screen whose Invoke (button or Ctrl+Enter) builds its own request, else why it has none. */
const INVOKE: Record<BuilderKey, true | string> = {
  generate: true,
  canvas: true,
  comic: true,
  upscaling: true,
  workflows: true,
  video: true,
  music: true,
  voice: true,
  logo: true,
  models: 'manages model files; it makes nothing',
  browse: 'finds models to download; it makes nothing',
  queue: 'shows the queue; it makes nothing',
  extensions: 'manages ComfyUI extensions; it makes nothing',
  text: 'the text editor places its layers itself; Invoke must not queue the image form from behind it',
};

describe('the registries after start-up', () => {
  for (const [key, need] of Object.entries(INVOKE) as [BuilderKey, true | string][]) {
    it(`${key}: ${need === true ? 'has an Invoke builder' : 'has no Invoke builder'}`, () => {
      expect(hasInvokeBuilder(key)).toBe(need === true);
    });
  }

  it('gives every screen the assistant can change an editor', () => {
    expect(EDIT_SCREENS.filter((screen) => !agentEditor(screen))).toEqual([]);
  });
});
