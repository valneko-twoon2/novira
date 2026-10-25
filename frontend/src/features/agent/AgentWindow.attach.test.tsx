// @vitest-environment jsdom
// The assistant window's pictures and copying: attaching from disk, a drop or a paste (files go to the gallery first),
// the limit, taking a picture off, sending pictures alone, the pictures of a sent message, selecting and copying a message.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ImageDTO } from '@/backend';
import { t } from '@/i18n';
import { useAgent, type AgentMessage, type SendResult } from '@/state/agent';
import { IMAGE_MIME } from '@/state/dnd';
import { useGallery } from '@/state/gallery';
import { useToasts } from '@/state/toasts';
import { TooltipProvider } from '@/ui';
import { AgentWindow } from './AgentWindow';

const ready = { provider: 'claude' as const, installed: true, loggedIn: true, models: [] };
const dto = (name: string, over: Partial<ImageDTO> = {}) => ({ name, url: `u/${name}`, thumbnailUrl: `t/${name}`, width: 8, height: 8, createdAt: 1, boardId: null, starred: false, isIntermediate: false, category: 'user', metadata: null, workflow: null, ...over }) as ImageDTO;
const file = (name: string, type = 'image/png') => new File(['x'], name, { type });

let send: ReturnType<typeof vi.fn<(text: string, images?: readonly string[]) => Promise<SendResult>>>;
let uploaded = 0;

function show(messages: AgentMessage[] = []) {
  send = vi.fn<(text: string, images?: readonly string[]) => Promise<SendResult>>().mockResolvedValue({ ok: true, cancelled: false, text: '' });
  useAgent.setState({ sessions: [{ id: 's1', createdAt: 1, updatedAt: 1, messages }], currentId: 's1', busy: false, busySessionId: null, status: ready, pos: null, send });
  return render(
    <TooltipProvider>
      <AgentWindow />
    </TooltipProvider>,
  );
}

/** Picks files with the paperclip. */
async function pick(...files: File[]) {
  fireEvent.change(await screen.findByTestId('agent-attach-file'), { target: { files } });
}

const strip = () => screen.queryByTestId('agent-attached');
const thumbs = () => within(strip()!).getAllByRole('img').map((img) => img.getAttribute('src'));

/** A drop event carrying gallery names and/or files. */
function drop(target: Element, { names, files = [] }: { names?: string[]; files?: File[] }) {
  const types = [...(names ? [IMAGE_MIME] : []), ...(files.length ? ['Files'] : [])];
  const dataTransfer = { types, files, getData: (type: string) => (type === IMAGE_MIME && names ? JSON.stringify(names) : ''), dropEffect: 'none' };
  fireEvent.dragOver(target, { dataTransfer });
  fireEvent.drop(target, { dataTransfer });
}

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});
afterAll(() => {
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
});
beforeEach(() => {
  localStorage.clear();
  uploaded = 0;
  vi.spyOn(backend, 'agentStatus').mockResolvedValue(ready);
  vi.spyOn(backend, 'uploadImage').mockImplementation(async () => dto(`up${++uploaded}.png`));
  useGallery.setState({ images: [dto('g1.png'), dto('g2.png'), dto('clip.mp4', { mediaType: 'video' })] });
  useToasts.setState({ toasts: [] });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('attaching pictures', () => {
  it('stores picked files in the gallery, shows them, and sends them with the message', async () => {
    show();
    await pick(file('a.png'), file('notes.txt', 'text/plain'), file('b.jpg', 'image/jpeg'));
    await waitFor(() => expect(strip()).not.toBeNull());
    expect(backend.uploadImage).toHaveBeenCalledTimes(2);
    expect(useGallery.getState().images.map((i) => i.name)).toEqual(expect.arrayContaining(['up1.png', 'up2.png']));
    expect(thumbs()).toEqual(['t/up1.png', 't/up2.png']);
    fireEvent.change(screen.getByTestId('agent-input'), { target: { value: 'a prompt like these' } });
    fireEvent.click(screen.getByTestId('agent-send'));
    expect(send).toHaveBeenCalledWith('a prompt like these', ['up1.png', 'up2.png']);
    expect(strip()).toBeNull();
  });

  it('sends pictures alone, and a picture taken off does not go', async () => {
    show();
    expect((screen.getByTestId('agent-send') as HTMLButtonElement).disabled).toBe(true);
    await pick(file('a.png'), file('b.png'));
    await waitFor(() => expect(thumbs()).toHaveLength(2));
    fireEvent.click(within(strip()!).getAllByLabelText(t('agent.attach.remove'))[0]!);
    expect(thumbs()).toEqual(['t/up2.png']);
    const sendButton = screen.getByTestId('agent-send') as HTMLButtonElement;
    expect(sendButton.disabled).toBe(false);
    fireEvent.click(sendButton);
    expect(send).toHaveBeenCalledWith('', ['up2.png']);
  });

  it('takes at most four and says so', async () => {
    show();
    await pick(file('1.png'), file('2.png'), file('3.png'));
    await waitFor(() => expect(thumbs()).toHaveLength(3));
    await pick(file('4.png'), file('5.png'));
    await waitFor(() => expect(useToasts.getState().toasts.at(-1)?.title).toBe(t('agent.attach.tooMany', { count: 4 })));
    expect(thumbs()).toEqual(['t/up1.png', 't/up2.png', 't/up3.png', 't/up4.png']);
  });

  it('reports a file the gallery refuses and keeps the others', async () => {
    vi.mocked(backend.uploadImage).mockRejectedValueOnce(new Error('broken PNG'));
    show();
    await pick(file('bad.png'), file('good.png'));
    await waitFor(() => expect(thumbs()).toEqual(['t/up1.png']));
    expect(useToasts.getState().toasts[0]).toMatchObject({ status: 'error', title: t('agent.attach.failed'), description: 'broken PNG' });
  });

  it('takes gallery pictures dropped on the input box without storing them again, but not videos', async () => {
    show();
    drop(screen.getByTestId('agent-form'), { names: ['g1.png', 'clip.mp4', 'g2.png'] });
    await waitFor(() => expect(thumbs()).toEqual(['t/g1.png', 't/g2.png']));
    expect(backend.uploadImage).not.toHaveBeenCalled();
    // The same picture again is not doubled.
    drop(screen.getByTestId('agent-form'), { names: ['g1.png'] });
    await waitFor(() => expect(thumbs()).toEqual(['t/g1.png', 't/g2.png']));
  });

  it('stores files dropped from disk or pasted into the box', async () => {
    show();
    drop(screen.getByTestId('agent-form'), { files: [file('disk.png')] });
    await waitFor(() => expect(thumbs()).toEqual(['t/up1.png']));
    fireEvent.paste(screen.getByTestId('agent-input'), { clipboardData: { files: [file('shot.png')] } });
    await waitFor(() => expect(thumbs()).toEqual(['t/up1.png', 't/up2.png']));
    // Pasting text is left to the box.
    fireEvent.paste(screen.getByTestId('agent-input'), { clipboardData: { files: [] } });
    expect(backend.uploadImage).toHaveBeenCalledTimes(2);
  });
});

describe('sent messages', () => {
  it('show the pictures they carried, and a picture no longer in the gallery as a placeholder', () => {
    show([{ id: 1, role: 'user', text: 'like this', images: ['g1.png', 'gone.png'], tools: [] }]);
    const pictures = screen.getByTestId('agent-msg-pictures');
    expect(within(pictures).getAllByRole('img').map((img) => img.getAttribute('src'))).toEqual(['t/g1.png', null]);
  });

  it('copy their text, and say so when the clipboard refuses', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    show([
      { id: 1, role: 'user', text: 'make it blue', tools: [] },
      { id: 2, role: 'assistant', text: 'Set the prompt to\n"a blue sky".', tools: [] },
    ]);
    const copies = screen.getAllByTestId('agent-copy');
    expect(copies).toHaveLength(2);
    fireEvent.click(copies[1]!);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Set the prompt to\n"a blue sky".'));
    await waitFor(() => expect(useToasts.getState().toasts.at(-1)).toMatchObject({ status: 'success', title: t('agent.copied') }));
    writeText.mockRejectedValueOnce(new Error('no'));
    fireEvent.click(copies[0]!);
    await waitFor(() => expect(useToasts.getState().toasts.at(-1)).toMatchObject({ status: 'error', title: t('agent.copyFailed') }));
  });
});
