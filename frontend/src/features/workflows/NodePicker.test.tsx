// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CORE_NODE_DEFS } from '@/backend/mock/comfyCoreDefs';
import { MOCK_NODE_DEFS } from '@/backend/mock/comfyNodeDefs';
import { PACK_NODE_DEFS } from '@/backend/mock/comfyPackDefs';
import { t } from '@/i18n';
import { comfyTemplates } from './comfyNodes';
import { NodePicker } from './NodePicker';
import { allTemplates, setExtensionTemplates } from './templates';

beforeAll(() => setExtensionTemplates(comfyTemplates({ ...MOCK_NODE_DEFS, ...CORE_NODE_DEFS, ...PACK_NODE_DEFS })));
afterAll(() => setExtensionTemplates([]));
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});
afterEach(cleanup);

const show = (onPick = vi.fn()) => {
  render(<NodePicker filter={null} onPick={onPick} onClose={() => {}} />);
  return { picker: screen.getByTestId('wf-node-picker'), onPick };
};
const scopes = () => screen.getAllByTestId('wf-picker-scope');
const items = (picker: HTMLElement) => picker.querySelectorAll('.wf-picker__item');

describe('node picker scopes', () => {
  it('offers all, each built-in category and each installed extension, with how many nodes each holds', () => {
    show();
    const labels = scopes().map((s) => s.textContent ?? '');
    expect(labels[0]).toBe(`${t('workflows.picker.all')}${allTemplates().length}`);
    const packs = new Set(allTemplates().flatMap((n) => (n.pack ? [n.pack] : [])));
    expect(packs.size).toBeGreaterThan(0);
    for (const pack of packs) expect(labels.some((l) => l.startsWith(pack))).toBe(true);
    expect(labels.some((l) => l.startsWith(t('workflows.categories.model')))).toBe(true);
  });

  it('shows only the nodes of the extension picked, and only the built-in ones for a category', () => {
    const { picker } = show();
    const pack = allTemplates().find((n) => n.pack)!.pack!;
    fireEvent.click(scopes().find((s) => s.textContent?.startsWith(pack))!);
    const count = allTemplates().filter((n) => n.pack === pack).length;
    expect(items(picker)).toHaveLength(count);
    fireEvent.click(scopes().find((s) => s.textContent?.startsWith(t('workflows.categories.model')))!);
    expect(items(picker).length).toBe(allTemplates().filter((n) => !n.pack && n.category === 'model').length);
    expect(picker.querySelectorAll('.wf-picker__group')).toHaveLength(0);
  });

  it("lists ComfyUI's own nodes by the start of their category, under a heading of their own", () => {
    const { picker } = show();
    expect(screen.getByTestId('wf-picker-scopes').textContent).toContain(t('workflows.picker.core'));
    const audio = allTemplates().filter((n) => n.group === 'audio');
    expect(audio.length).toBeGreaterThan(0);
    const scope = scopes().find((s) => s.textContent === `audio${audio.length}`)!;
    fireEvent.click(scope);
    expect(items(picker)).toHaveLength(audio.length);
    // A search finds them by what they do: the Save Audio node by the formats it names.
    fireEvent.click(scopes()[0]!);
    fireEvent.change(screen.getByLabelText(t('workflows.picker.placeholder')), { target: { value: 'save audio' } });
    expect([...items(picker)].map((i) => i.textContent).join(' ')).toContain('Save Audio (Advanced)');
  });

  it('picks the node that is clicked, and falls back to everything when a search empties the scope', () => {
    const { picker, onPick } = show();
    const pack = allTemplates().find((n) => n.pack)!.pack!;
    fireEvent.click(scopes().find((s) => s.textContent?.startsWith(pack))!);
    fireEvent.change(screen.getByLabelText(t('workflows.picker.placeholder')), { target: { value: 'blur' } });
    const blur = [...items(picker)][0] as HTMLElement | undefined;
    expect(blur).toBeTruthy();
    fireEvent.click(blur!);
    expect(onPick).toHaveBeenCalledTimes(1);
  });
});
