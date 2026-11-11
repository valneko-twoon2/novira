// @vitest-environment jsdom
// The Image accordion: width and height keep the chosen shape, the canvas adds the denoising strength.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { useParams } from '@/state/params';
import { TooltipProvider } from '@/ui';
import { ImageSection } from './ImageSection';

const initial = useParams.getState();
const state = () => useParams.getState();
const show = (tab: 'generate' | 'canvas') => render(<TooltipProvider><ImageSection tab={tab} /></TooltipProvider>);
const num = (label: string) => screen.getAllByLabelText(label).find((e) => (e as HTMLInputElement).type === 'number') as HTMLInputElement;
const setNum = (label: string, value: number) => {
  fireEvent.change(num(label), { target: { value: String(value) } });
  fireEvent.blur(num(label));
};

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useParams.setState({ ...initial, width: 1024, height: 1024, aspectRatio: '1:1', aspectLocked: true, strength: 0.7 });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ImageSection', () => {
  it('shows the size and the shape as badges and changes the width and height', { tags: ['scenario'] }, () => {
    show('generate');
    expect(screen.getAllByText('1024×1024').length).toBeGreaterThan(0);
    setNum(t('common.width'), 768);
    expect(state().width).toBe(768);
    expect(state().height).toBe(768);
    useParams.setState({ aspectLocked: false });
    setNum(t('common.height'), 512);
    expect(state().height).toBe(512);
    expect(state().width).toBe(768);
    expect(state().aspectRatio).toBe('free');
  });

  it('has no denoising strength on the Generate screen', { tags: ['condition'] }, () => {
    show('generate');
    expect(screen.queryAllByLabelText(t('params.image.strength'))).toHaveLength(0);
  });

  it('the canvas names the box and sets the strength', { tags: ['scenario'] }, () => {
    show('canvas');
    expect(screen.getByText(t('params.image.bboxHint'))).toBeTruthy();
    setNum(t('params.image.strength'), 0.4);
    expect(state().strength).toBe(0.4);
  });
});
