// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { emptyPanel } from '@/state/comic/document';
import { newPerson, newRough, type ComicRough } from '@/state/comic/rough';
import type { RoughSceneEvents } from './scene';
import { TooltipProvider } from '@/ui';
import { RoughDialog } from './RoughDialog';

const fake = vi.hoisted(() => ({
  create: vi.fn(),
  set: vi.fn(),
  select: vi.fn(),
  dispose: vi.fn(),
  events: null as RoughSceneEvents | null,
  fail: false,
}));

vi.mock('./scene', () => ({
  createRoughScene: (canvas: unknown, rough: unknown, aspect: unknown, events: RoughSceneEvents) => {
    if (fake.fail) throw new Error('no WebGL');
    fake.create(canvas, rough, aspect);
    fake.events = events;
    return { set: fake.set, select: fake.select, resize: () => undefined, dispose: fake.dispose };
  },
}));

const applied = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('@/state/comic/roughPanel', async (original) => ({ ...(await original<typeof import('@/state/comic/roughPanel')>()), applyRough: applied }));

const panel = () => ({ ...emptyPanel(), id: 'panel-1' });
const mount = (onClose = vi.fn(), over: Partial<ReturnType<typeof panel>> = {}) => {
  render(
    <TooltipProvider>
      <RoughDialog open panel={{ ...panel(), ...over }} width={1200} height={800} onClose={onClose} />
    </TooltipProvider>,
  );
  return onClose;
};
const things = () => screen.getAllByRole('listitem').map((el) => el.textContent);

describe('the 3D rough editor', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    for (const f of [fake.create, fake.set, fake.select, fake.dispose, applied]) f.mockClear();
    fake.events = null;
    fake.fail = false;
  });
  afterEach(() => cleanup());

  it('opens the view at the panel shape on a standing person, chosen', async () => {
    mount();
    await waitFor(() => expect(fake.create).toHaveBeenCalled());
    const [, rough, aspect] = fake.create.mock.calls[0] as [unknown, ComicRough, number];
    expect(aspect).toBeCloseTo(1.5);
    expect(rough.people).toHaveLength(1);
    expect(things()).toEqual([t('comic.rough.name.person', { number: 1 })]);
    expect(screen.getByTestId('comic-rough-person')).toBeTruthy();
    expect(fake.select).toHaveBeenLastCalledWith(rough.people[0]!.id);
  });

  it('opens the panel own rough while its depth map is current', async () => {
    const own = { ...newRough(), people: [newPerson(), newPerson(1, 0)] };
    mount(vi.fn(), { rough: own, depthImageName: 'depth.png' });
    await waitFor(() => expect(fake.create).toHaveBeenCalled());
    expect((fake.create.mock.calls[0] as [unknown, ComicRough])[1]).toEqual(own);
  });

  it('adds a box, shows it in the view and chooses it; removes it again', async () => {
    mount();
    await waitFor(() => expect(fake.create).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('comic-rough-add-box'));
    expect(things()).toEqual([t('comic.rough.name.person', { number: 1 }), t('comic.rough.name.box', { number: 1 })]);
    const shown = fake.set.mock.calls.at(-1)?.[0] as ComicRough;
    expect(shown.props.map((p) => p.shape)).toEqual(['box']);
    expect(screen.getByTestId('comic-rough-prop')).toBeTruthy();
    fireEvent.click(screen.getByTestId('comic-rough-remove'));
    expect(things()).toEqual([t('comic.rough.name.person', { number: 1 })]);
    expect(screen.queryByTestId('comic-rough-prop')).toBeNull();
  });

  it('takes what is dragged in the view and does not hand it back to the view', async () => {
    mount();
    await waitFor(() => expect(fake.events).not.toBeNull());
    const dragged = { ...newRough(), people: [newPerson(), newPerson(2, 0)] };
    fake.set.mockClear();
    act(() => fake.events!.change(dragged));
    expect(things()).toHaveLength(2);
    expect(fake.set).not.toHaveBeenCalled();
    act(() => fake.events!.select(null));
    expect(screen.getByText(t('comic.rough.nothing'))).toBeTruthy();
  });

  it('bakes the rough into the panel at its picture size and closes', async () => {
    const onClose = mount();
    await waitFor(() => expect(fake.create).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('comic-rough-add-plane'));
    fireEvent.click(screen.getByTestId('comic-rough-apply'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [panelId, rough, width, height] = applied.mock.calls[0] as unknown as [string, ComicRough, number, number];
    expect([panelId, width, height]).toEqual(['panel-1', 1200, 800]);
    expect(rough.props.map((p) => p.shape)).toEqual(['plane']);
  });

  it('says so when the browser gives no 3D view, and still bakes what the side panel set', async () => {
    fake.fail = true;
    const onClose = mount();
    expect(await screen.findByTestId('comic-rough-failed')).toBeTruthy();
    fireEvent.click(screen.getByTestId('comic-rough-apply'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(applied).toHaveBeenCalledTimes(1);
  });
});
