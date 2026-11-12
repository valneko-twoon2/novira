// Shared fixtures of the Candidates view's component tests: candidates, batches, pictures, a fresh state and the view.
import { cleanup, render } from '@testing-library/react';
import { vi } from 'vitest';
import { useDraftForm } from '@/state/draftForm';
import { useDrafts, type DraftCandidate, type DraftGroup } from '@/state/drafts';
import { useGallery } from '@/state/gallery';
import { useModels } from '@/state/models';
import { SETTINGS_DEFAULTS, useSettings } from '@/state/settings';
import { useToasts } from '@/state/toasts';
import { TooltipProvider } from '@/ui';
import { DraftsView } from './DraftsView';

const initial = { drafts: useDrafts.getState(), gallery: useGallery.getState(), toasts: useToasts.getState(), models: useModels.getState() };

export const lastToast = () => useToasts.getState().toasts.at(-1);

export const candidate = (n: number, over: Partial<DraftCandidate> = {}): DraftCandidate => ({
  id: `c${n}`,
  seed: 100 + n,
  itemId: n,
  imageName: `d${n}.png`,
  status: 'ready',
  error: null,
  finalItemId: null,
  finalImageName: null,
  finalStatus: null,
  verdict: null,
  ...over,
});

export const group = (id: string, candidates: DraftCandidate[], over: Partial<DraftGroup> = {}): DraftGroup => ({
  id,
  createdAt: 0,
  params: { modelName: `Model ${id}`, positivePrompt: `prompt of ${id}`, steps: 28, width: 512, height: 768 } as DraftGroup['params'],
  boardId: null,
  position: 0.35,
  candidates,
  ...over,
});

/** A generation batch's candidate: drawn to the end at once, its picture `g<n>.png`. */
export const made = (n: number, over: Partial<DraftCandidate> = {}) => candidate(n, { itemId: null, imageName: null, finalItemId: n, finalImageName: `g${n}.png`, finalStatus: 'ready', ...over });
export const batch = (id: string, candidates: DraftCandidate[], over: Partial<DraftGroup> = {}): DraftGroup => group(id, candidates, { kind: 'generation', position: 1, ...over });

export const picture = (name: string, isIntermediate = true) => ({ name, url: `blob:${name}`, thumbnailUrl: `blob:t-${name}`, width: 512, height: 768, isIntermediate }) as never;

export function resetDrafts() {
  useDraftForm.setState({ count: null, percent: null, thumbSize: 168 });
  useSettings.setState({ draftCount: SETTINGS_DEFAULTS.draftCount, draftPosition: SETTINGS_DEFAULTS.draftPosition });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useDrafts.setState({ ...initial.drafts, groups: [], currentId: null, selection: [], busy: false }, true);
  useGallery.setState({ ...initial.gallery, images: [], boards: [], selectedBoardId: 'none' }, true);
  useToasts.setState(initial.toasts, true);
  useModels.setState(initial.models, true);
}

export function cleanupDrafts() {
  cleanup();
  useSettings.getState().reset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
}

export const show = (onOpen?: (name: string) => void) =>
  render(
    <TooltipProvider>{onOpen ? <DraftsView onOpen={onOpen} /> : <DraftsView />}</TooltipProvider>,
  );
