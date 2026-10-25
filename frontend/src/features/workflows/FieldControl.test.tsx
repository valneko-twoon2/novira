// @vitest-environment jsdom
// The control behind a node field: which widget each field type gets, and that editing it writes the value to the node.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ImageDTO, type ModelConfig } from '@/backend';
import { t } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { useModels } from '@/state/models';
import { IMAGE_MIME } from '@/state/dnd';
import { useWorkflows } from '@/state/workflows/workflows';
import { TooltipProvider } from '@/ui';
import { FieldControl } from './FieldControl';
import { createNode } from './graph';
import { getTemplate, type InputTemplate } from './templates';

const initial = { workflows: useWorkflows.getState(), gallery: useGallery.getState(), models: useModels.getState() };
const node = () => createNode(getTemplate('integer')!, { x: 0, y: 0 }, { id: 'n1' });

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useWorkflows.setState({ ...initial.workflows, nodes: [node()], edges: [] }, true);
  useGallery.setState(initial.gallery, true);
  useModels.setState(initial.models, true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const stored = () => useWorkflows.getState().nodes[0]!.data.inputs;
const field = (input: Partial<InputTemplate> & Pick<InputTemplate, 'type'>, value: unknown) => {
  const full: InputTemplate = { name: 'x', input: 'any', ...input };
  return render(
    <TooltipProvider>
      <FieldControl nodeId="n1" input={full} value={value} label="The field" />
    </TooltipProvider>,
  );
};
const image = (name: string): ImageDTO => ({ name, thumbnailUrl: `thumb-${name}`, width: 640, height: 480 }) as ImageDTO;

describe('numbers', () => {
  it('commits an integer on blur and clamps it to the range', () => {
    field({ type: 'integer', min: 1, max: 10, step: 1, default: 5 }, undefined);
    const box = screen.getByLabelText('The field') as HTMLInputElement;
    expect(box.value).toBe('5');
    fireEvent.change(box, { target: { value: '99' } });
    fireEvent.blur(box);
    expect(stored().x).toBe(10);
  });

  it('shows a float with two decimals', () => {
    field({ type: 'float', step: 0.05 }, 0.5);
    expect((screen.getByLabelText('The field') as HTMLInputElement).value).toBe('0.50');
  });

  it('shows a slider with a number box when the field asks for a slider', () => {
    field({ type: 'float', ui: 'slider', min: 0, max: 2, step: 0.1 }, 1);
    expect(screen.getByRole('slider')).toBeTruthy();
    const box = screen.getAllByLabelText('The field').find((e) => e.tagName === 'INPUT') as HTMLInputElement;
    fireEvent.change(box, { target: { value: '1.5' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(stored().x).toBe(1.5);
  });
});

describe('text, switch and choices', () => {
  it('edits a single-line and a multi-line string', () => {
    const { unmount } = field({ type: 'string' }, 'old');
    fireEvent.change(screen.getByLabelText('The field'), { target: { value: 'new' } });
    expect(stored().x).toBe('new');
    unmount();
    field({ type: 'string', ui: 'textarea' }, 5);
    const area = screen.getByLabelText('The field') as HTMLTextAreaElement;
    expect(area.tagName).toBe('TEXTAREA');
    expect(area.value).toBe('');
    fireEvent.change(area, { target: { value: 'two\nlines' } });
    expect(stored().x).toBe('two\nlines');
  });

  it('flips a switch', () => {
    field({ type: 'boolean' }, false);
    const sw = screen.getByRole('switch');
    expect(sw.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(sw);
    expect(stored().x).toBe(true);
  });

  it('renders the choices of an enum, a scheduler and a board field', () => {
    useGallery.setState({ boards: [{ id: 'b1', name: 'Mine', archived: false }, { id: 'b2', name: 'Old', archived: true }] as never });
    const { unmount } = field({ type: 'enum', options: ['a', 'b'] }, 'b');
    expect(screen.getByLabelText('The field').textContent).toContain('b');
    unmount();
    const scheduler = field({ type: 'SchedulerField', options: ['euler', 'dpmpp_2m_k', 'custom'] }, 'dpmpp_2m_k');
    expect(screen.getByLabelText('The field').textContent).toContain('DPM++ 2M Karras');
    scheduler.unmount();
    field({ type: 'BoardField' }, undefined);
    expect(screen.getByLabelText('The field').textContent).toContain(t('workflows.field.boardAuto'));
  });

  it('renders nothing for a type it has no control for', () => {
    const { container } = field({ type: 'LatentsField' as never }, null);
    expect(container.querySelector('.wf-control')!.childElementCount).toBe(0);
  });
});

describe('models', () => {
  const lora = (key: string): ModelConfig => ({ key, name: `Lora ${key}`, base: 'sdxl', type: 'lora' }) as ModelConfig;

  it('says there are no models of that type', () => {
    field({ type: 'LoRAModelField' }, null);
    expect(screen.getByLabelText('The field').textContent).toContain(t('workflows.field.noModels'));
  });

  it('shows the picked model and asks to pick when the stored key is not installed', () => {
    useModels.setState({ models: [lora('l1')] });
    const { unmount } = field({ type: 'LoRAModelField' }, 'l1');
    expect(screen.getByLabelText('The field').textContent).toContain('Lora l1');
    unmount();
    field({ type: 'LoRAModelField' }, 'gone');
    expect(screen.getByLabelText('The field').textContent).toContain(t('workflows.field.selectModel'));
  });
});

describe('pictures', () => {
  it('shows the picture with its size, and clears it', () => {
    useGallery.setState({ images: [image('a.png')] });
    field({ type: 'ImageField' }, 'a.png');
    expect(screen.getByAltText('a.png').getAttribute('src')).toBe('thumb-a.png');
    expect(screen.getByText('640×480')).toBeTruthy();
    fireEvent.click(screen.getByLabelText(t('workflows.field.clearImage')));
    expect(stored().x).toBeNull();
  });

  it('asks for a picture when there is none, and takes one dropped from the gallery', async () => {
    const { container } = field({ type: 'ImageField' }, null);
    expect(screen.getByText(t('workflows.field.dropImageHint'))).toBeTruthy();
    fireEvent.drop(container.querySelector('.ui-dropzone')!, { dataTransfer: { types: [IMAGE_MIME], files: [], getData: () => JSON.stringify(['b.png']) } });
    await waitFor(() => expect(stored().x).toBe('b.png'));
  });

  it('uploads a picture file dropped on it and uses the new gallery picture', async () => {
    const upload = vi.spyOn(backend, 'uploadImage').mockResolvedValue(image('up.png'));
    const { container } = field({ type: 'ImageField' }, null);
    const file = new File(['x'], 'p.png', { type: 'image/png' });
    fireEvent.drop(container.querySelector('.ui-dropzone')!, { dataTransfer: { types: ['Files'], files: [file], getData: () => '' } });
    await waitFor(() => expect(stored().x).toBe('up.png'));
    expect(upload).toHaveBeenCalledWith(file, { boardId: null, category: 'user' });
    expect(useGallery.getState().images.some((i) => i.name === 'up.png')).toBe(true);
  });

  it('ignores a dropped file that is not a picture', () => {
    const upload = vi.spyOn(backend, 'uploadImage');
    const { container } = field({ type: 'ImageField' }, null);
    act(() => {
      fireEvent.drop(container.querySelector('.ui-dropzone')!, { dataTransfer: { types: ['Files'], files: [new File(['x'], 't.txt', { type: 'text/plain' })], getData: () => '' } });
    });
    expect(upload).not.toHaveBeenCalled();
    expect(stored().x).toBeUndefined();
  });
});
