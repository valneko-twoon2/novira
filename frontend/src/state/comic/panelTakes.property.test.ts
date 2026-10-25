// Whatever pictures a panel is given, one after another (redraws, pictures put in by hand, the picture taken out), its list
// of earlier pictures stays a clean list: no repeats, never the picture the panel shows, never longer than TAKES_MAX.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { blockExternalNetwork, check } from '@/propertyTest.testkit';
import { newProject, TAKES_MAX } from './document';
import { findPanel, useComic } from './store';

blockExternalNetwork();

function seed() {
  const project = newProject('P');
  project.pages[0]!.panels = [{ ...project.pages[0]!.panels[0]!, id: 'panel-0' }];
  useComic.setState({ projects: [], activeProjectId: null, activePageId: null, selectedPanelId: null, selectedBubbleId: null, pending: {} });
  useComic.getState().setProjects([project]);
}

describe('the earlier pictures of a panel (properties)', () => {
  it('never hold the panel picture or a picture twice, and never more than TAKES_MAX', () => {
    const picture = fc.oneof(fc.constantFrom('a.png', 'b.png', 'c.png', 'd.png', null), fc.string({ minLength: 1, maxLength: 3 }));
    const step = fc.oneof(fc.record({ set: picture }), fc.record({ remove: fc.constantFrom('a.png', 'b.png', 'x.png') }));
    check(
      fc.property(fc.array(step, { maxLength: 40 }), (steps) => {
        seed();
        for (const s of steps) {
          if ('set' in s) useComic.getState().setPanelImage('panel-0', s.set);
          else useComic.getState().removeTake('panel-0', s.remove);
        }
        const panel = findPanel(useComic.getState().projects, 'panel-0')!.panel;
        const list = panel.takes.map((t) => t.imageName);
        expect(new Set(list).size).toBe(list.length);
        expect(list).not.toContain(panel.imageName);
        expect(list.length).toBeLessThanOrEqual(TAKES_MAX);
      }),
    );
  });
});
