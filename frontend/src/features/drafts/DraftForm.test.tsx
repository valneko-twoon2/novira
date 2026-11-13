// @vitest-environment jsdom
// The "Drafts" button of the Candidates view: the form it opens (model, count, position) and starting a batch from it.
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { useDrafts } from '@/state/drafts';
import { useModels } from '@/state/models';
import { useSettings } from '@/state/settings';
import { cleanupDrafts, lastToast, resetDrafts, show } from './drafts.testkit';

beforeEach(resetDrafts);
afterEach(cleanupDrafts);

/** Opens the form with the "Drafts" button. */
const openForm = () => fireEvent.click(screen.getByTestId('drafts-form-toggle'));
const countBox = () => screen.getAllByLabelText(t('drafts.count')).find((e) => (e as HTMLInputElement).type === 'number')!;
const type = (box: HTMLElement, value: string) => {
  fireEvent.change(box, { target: { value } });
  fireEvent.blur(box);
};

describe('the draft form', { tags: [] }, () => {
  it('is closed until the Drafts button opens it, and closes once a batch has started', { tags: ['state-transition'] }, async () => {
    const start = vi.fn().mockResolvedValue(null);
    useDrafts.setState({ start });
    show();
    expect(screen.getByTestId('drafts-form-toggle').textContent).toBe(t('drafts.form'));
    expect(screen.queryByTestId('drafts-form')).toBeNull();
    openForm();
    expect(screen.getByTestId('drafts-form')).toBeTruthy();
    fireEvent.click(screen.getByTestId('drafts-start'));
    await waitFor(() => expect(start).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId('drafts-form')).toBeNull());
  });

  it('starts a batch with the chosen count and position', { tags: ['scenario'] }, async () => {
    const start = vi.fn().mockResolvedValue(null);
    useDrafts.setState({ start });
    show();
    expect(screen.getByText(t('drafts.empty.title'))).toBeTruthy();
    openForm();
    type(countBox(), '12');
    fireEvent.click(screen.getByTestId('drafts-start'));
    await waitFor(() => expect(start).toHaveBeenCalledWith(12, 0.35, null));
    expect(lastToast()).toBeUndefined();
  });

  it('starts with the count the settings give, and keeps what is typed for this run', { tags: ['scenario', 'condition'] }, async () => {
    const start = vi.fn().mockResolvedValue(null);
    useDrafts.setState({ start });
    useSettings.getState().set({ draftCount: 10 });
    show();
    openForm();
    fireEvent.click(screen.getByTestId('drafts-start'));
    await waitFor(() => expect(start).toHaveBeenLastCalledWith(10, 0.35, null));
    openForm();
    type(countBox(), '3');
    fireEvent.click(screen.getByTestId('drafts-start'));
    await waitFor(() => expect(start).toHaveBeenLastCalledWith(3, 0.35, null));
    expect(useSettings.getState().draftCount).toBe(10);
  });

  it('starts the position from the settings, and keeps count and position when the screen is shown again', { tags: ['scenario'] }, async () => {
    const start = vi.fn().mockResolvedValue(null);
    useDrafts.setState({ start });
    useSettings.getState().set({ draftPosition: 50 });
    const view = show();
    openForm();
    type(countBox(), '7');
    type(screen.getAllByLabelText(t('drafts.position')).find((e) => (e as HTMLInputElement).type === 'number')!, '30');
    view.unmount();
    // Another screen was shown meanwhile: the box and the slider come back as they were set, not from the settings.
    show();
    openForm();
    fireEvent.click(screen.getByTestId('drafts-start'));
    await waitFor(() => expect(start).toHaveBeenLastCalledWith(7, 0.3, null));
    expect(useSettings.getState().draftPosition).toBe(50);
  });

  it('explains why a batch could not start, reports a failure, and stays open', { tags: ['error-guessing'] }, async () => {
    const start = vi.fn().mockResolvedValueOnce({ error: 'edit-model' }).mockResolvedValueOnce({ error: 'no-builder' }).mockRejectedValueOnce(new Error('queue down'));
    useDrafts.setState({ start });
    show();
    openForm();
    fireEvent.click(screen.getByTestId('drafts-start'));
    await waitFor(() => expect(lastToast()).toMatchObject({ status: 'warning', title: t('drafts.editModel') }));
    fireEvent.click(screen.getByTestId('drafts-start'));
    await waitFor(() => expect(lastToast()).toMatchObject({ title: t('drafts.notReady') }));
    fireEvent.click(screen.getByTestId('drafts-start'));
    await waitFor(() => expect(lastToast()).toMatchObject({ status: 'error', description: 'queue down' }));
    expect(screen.getByTestId('drafts-form')).toBeTruthy();
  });
});

describe('model of the drafts', { tags: [] }, () => {
  it('starts the drafts with the model picked here instead of the Generate tab model', { tags: ['scenario'] }, async () => {
    const start = vi.fn().mockResolvedValue(null);
    useDrafts.setState({ start });
    useModels.setState({ models: [{ key: 'm1', name: 'Anime XL', base: 'sdxl', type: 'main' } as never] });
    show();
    openForm();
    fireEvent.click(screen.getByTestId('drafts-model'));
    fireEvent.click(screen.getByText('Anime XL'));
    fireEvent.click(screen.getByTestId('drafts-start'));
    await waitFor(() => expect(start).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 'm1'));
  });

  it('offers the diffusion models of the newer families, and names the edit models it leaves out', { tags: ['condition'] }, () => {
    useModels.setState({
      models: [
        { key: 'm1', name: 'Anime XL', base: 'sdxl', type: 'main', path: 'animeXL.safetensors' },
        { key: 'm2', name: 'NyaNya Anima', base: 'anima', type: 'diffusion_model', path: 'nyanya.safetensors' },
        { key: 'm3', name: 'Kontext', base: 'flux', type: 'diffusion_model', path: 'flux1-kontext-dev.safetensors' },
        { key: 'm4', name: 'Wan 5B', base: 'wan', type: 'diffusion_model', path: 'wan2.2_ti2v_5B.safetensors' },
      ] as never,
    });
    show();
    openForm();
    expect(screen.getByTestId('drafts-left-out').textContent).toBe(t('drafts.leftOut', { names: 'Kontext' }));
    fireEvent.click(screen.getByTestId('drafts-model'));
    const list = screen.getByTestId('model-picker-list');
    expect(within(list).getByText('NyaNya Anima')).toBeTruthy();
    expect(within(list).getByText('Anime XL')).toBeTruthy();
    expect(within(list).queryByText('Kontext')).toBeNull();
    expect(within(list).queryByText('Wan 5B')).toBeNull();
  });

  it('says nothing is left out when every model can draft', { tags: ['condition'] }, () => {
    useModels.setState({ models: [{ key: 'm1', name: 'Anime XL', base: 'sdxl', type: 'main', path: 'a.safetensors' }] as never });
    show();
    openForm();
    expect(screen.queryByTestId('drafts-left-out')).toBeNull();
  });
});
