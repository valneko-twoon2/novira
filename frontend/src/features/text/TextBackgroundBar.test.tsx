// @vitest-environment jsdom
// The background controls in the Text tab's canvas toolbar: image, colour or transparent, and the canvas size.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { t } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { useTextEditor } from '@/state/text/textEditor';
import { EMPTY_SCENE } from '@/state/text/textModel';
import { TooltipProvider } from '@/ui';
import { TextBackgroundBar } from './TextBackgroundBar';

const initial = { editor: useTextEditor.getState(), gallery: useGallery.getState() };
const state = () => useTextEditor.getState();

beforeEach(() => {
  useTextEditor.setState({ ...initial.editor, scene: { ...EMPTY_SCENE, layers: [] }, selectedId: null, past: [], future: [] }, true);
  useGallery.setState({ ...initial.gallery, images: [], viewerImageName: null }, true);
  render(
    <TooltipProvider>
      <TextBackgroundBar />
    </TooltipProvider>,
  );
});
afterEach(cleanup);

const bar = () => within(screen.getByTestId('text-background'));
const click = (label: string) => fireEvent.click(bar().getByText(label));
const setNum = (label: string, value: number) => {
  const input = bar().getByLabelText(label) as HTMLInputElement;
  fireEvent.change(input, { target: { value: String(value) } });
  fireEvent.blur(input);
};

describe('TextBackgroundBar', () => {
  it('switches between a colour, transparent and a picture from the viewer', { tags: ['scenario'] }, () => {
    click(t('text.bg.color'));
    expect(state().scene.background).toEqual({ kind: 'color', color: '#ffffff' });
    fireEvent.change(bar().getByLabelText(t('text.color')), { target: { value: '#336699' } });
    expect(state().scene.background).toEqual({ kind: 'color', color: '#336699' });
    click(t('text.bg.transparent'));
    expect(state().scene.background).toEqual({ kind: 'color', color: null });
    expect(bar().queryByLabelText(t('text.color'))).toBeNull();
    // No picture in the viewer: the image button is off.
    expect((bar().getByText(t('text.bg.image')) as HTMLButtonElement).disabled).toBe(true);
  });

  it('uses the picture open in the viewer as the background and shows its size instead of the size fields', { tags: ['scenario'] }, () => {
    act(() => useGallery.setState({ images: [{ name: 'v.png', url: 'u', width: 800, height: 600 } as never], viewerImageName: 'v.png' }));
    click(t('text.bg.image'));
    expect(state().scene).toMatchObject({ width: 800, height: 600, background: { kind: 'image', imageName: 'v.png' } });
    expect(bar().getByText('800 × 600')).toBeTruthy();
    expect(bar().queryByLabelText(t('text.bg.width'))).toBeNull();
    // The picture's name is in the info mark's tooltip, opened by a keyboard focus.
    fireEvent.keyDown(document, { key: 'Tab' });
    act(() => bar().getByTestId('info-mark').focus());
    expect(screen.getByRole('tooltip').textContent).toContain(t('text.bg.imageNote', { name: 'v.png' }));
    click(t('text.bg.color'));
    click(t('text.bg.image'));
    expect(state().scene.background.kind).toBe('image');
  });

  it('resizes the canvas from the number boxes', { tags: ['equivalence'] }, () => {
    setNum(t('text.bg.width'), 640);
    setNum(t('text.bg.height'), 480);
    expect(state().scene).toMatchObject({ width: 640, height: 480 });
  });
});
