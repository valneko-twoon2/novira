// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IMAGE_MIME } from '@/state/dnd';
import { ImageDropZone } from './ImageDropZone';

afterEach(() => cleanup());

const setup = (props: { onFiles?: (files: File[]) => void; disabled?: boolean } = {}) => {
  const onImages = vi.fn();
  render(
    <ImageDropZone onImages={onImages} label="Drop here" disabled={props.disabled} onFiles={props.onFiles}>
      <span data-testid="inside">content</span>
    </ImageDropZone>,
  );
  const zone = screen.getByTestId('inside').parentElement!;
  return { onImages, zone };
};
const transfer = (types: string[], files: File[] = [], data: Record<string, string> = {}) => ({ dataTransfer: { types, files, dropEffect: '', getData: (type: string) => data[type] ?? '' } });

describe('ImageDropZone', () => {
  it('shows its label while a gallery picture or a file is dragged over, and hides it when the drag leaves', () => {
    const { zone } = setup();
    fireEvent.dragOver(zone, transfer([IMAGE_MIME]));
    expect(screen.getByText('Drop here')).toBeTruthy();
    expect(zone.className).toContain('is-over');
    fireEvent.dragLeave(zone, { relatedTarget: null });
    expect(screen.queryByText('Drop here')).toBeNull();
    fireEvent.dragEnter(zone, transfer(['Files']));
    expect(screen.getByText('Drop here')).toBeTruthy();
  });

  it('puts its label away when the drop lands on something else, or the drag is cancelled', () => {
    const { zone } = setup();
    fireEvent.dragOver(zone, transfer([IMAGE_MIME]));
    expect(screen.getByText('Drop here')).toBeTruthy();
    fireEvent.drop(document.body);
    expect(screen.queryByText('Drop here')).toBeNull();
    fireEvent.dragOver(zone, transfer([IMAGE_MIME]));
    fireEvent.dragEnd(document.body);
    expect(screen.queryByText('Drop here')).toBeNull();
  });

  it('puts its label away when the pointer or a key is used again, as no drag can still be under way', () => {
    const { zone } = setup();
    fireEvent.dragOver(zone, transfer([IMAGE_MIME]));
    fireEvent.pointerMove(document.body, { movementX: 0, movementY: 0 });
    expect(screen.getByText('Drop here')).toBeTruthy();
    fireEvent.pointerMove(document.body, { movementX: 3, movementY: 0 });
    expect(screen.queryByText('Drop here')).toBeNull();
    fireEvent.dragOver(zone, transfer([IMAGE_MIME]));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByText('Drop here')).toBeNull();
    fireEvent.dragOver(zone, transfer([IMAGE_MIME]));
    fireEvent.keyDown(document.body, { key: 'a' });
    expect(screen.queryByText('Drop here')).toBeNull();
  });

  it('ignores drags of other things', () => {
    const { zone } = setup();
    fireEvent.dragOver(zone, transfer(['text/plain']));
    expect(screen.queryByText('Drop here')).toBeNull();
  });

  it('hands over the names of dropped gallery pictures', async () => {
    const { zone, onImages } = setup();
    fireEvent.drop(zone, transfer([IMAGE_MIME], [], { [IMAGE_MIME]: JSON.stringify(['a.png', 'b.png']) }));
    await waitFor(() => expect(onImages).toHaveBeenCalledWith(['a.png', 'b.png'], { alt: false }));
  });

  it('hands over only the image files of a drop from the desktop, and nothing when there is no file handler', async () => {
    const onFiles = vi.fn();
    const { zone } = setup({ onFiles });
    const png = new File(['x'], 'x.png', { type: 'image/png' });
    const text = new File(['x'], 'x.txt', { type: 'text/plain' });
    fireEvent.drop(zone, transfer(['Files'], [png, text]));
    await waitFor(() => expect(onFiles).toHaveBeenCalledWith([png], { alt: false }));
    fireEvent.drop(zone, transfer(['Files'], [text]));
    await new Promise((r) => setTimeout(r, 10));
    expect(onFiles).toHaveBeenCalledTimes(1);
    cleanup();
    const { zone: bare, onImages } = setup();
    fireEvent.drop(bare, transfer(['Files'], [png]));
    await new Promise((r) => setTimeout(r, 10));
    expect(onImages).not.toHaveBeenCalled();
  });

  it('does nothing while disabled', async () => {
    const onFiles = vi.fn();
    const { zone, onImages } = setup({ disabled: true, onFiles });
    fireEvent.dragOver(zone, transfer([IMAGE_MIME]));
    expect(screen.queryByText('Drop here')).toBeNull();
    fireEvent.drop(zone, transfer([IMAGE_MIME], [], { [IMAGE_MIME]: JSON.stringify(['a.png']) }));
    await new Promise((r) => setTimeout(r, 10));
    expect(onImages).not.toHaveBeenCalled();
    expect(onFiles).not.toHaveBeenCalled();
  });
});
