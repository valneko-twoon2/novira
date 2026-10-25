// Pictures that go with a chat message: the attach button (files from disk), the strip of pictures waiting above the
// input box, the pictures shown in a sent message, and the helpers that take pictures from a drop or a paste. Files are
// stored in the gallery first, so the backend is only ever given gallery names.
import { ImageSquare, Paperclip, X } from '@phosphor-icons/react';
import { useRef, type DragEvent } from 'react';
import { AGENT_MAX_ATTACHMENTS, backend } from '@/backend';
import { t } from '@/i18n';
import { resolveDropImages } from '@/state/dnd';
import { findImage, useGallery } from '@/state/gallery';
import { autoAddBoardId } from '@/state/invoke';
import { toast } from '@/state/toasts';
import { IconButton } from '@/ui';

/** Whether a gallery name is a still picture (videos and sounds cannot be attached; an unknown name is left to the backend). */
const isPicture = (name: string) => (findImage(name)?.mediaType ?? 'image') === 'image';

/** Stores the picture files in the gallery and returns their names; a file that fails is reported and left out. */
export async function storeFiles(files: readonly File[]): Promise<string[]> {
  const names: string[] = [];
  for (const file of files.filter((f) => f.type.startsWith('image/'))) {
    try {
      const saved = await backend.uploadImage(file, { boardId: autoAddBoardId(), category: 'user' });
      useGallery.getState().addImage(saved);
      names.push(saved.name);
    } catch (e) {
      toast({ status: 'error', title: t('agent.attach.failed'), description: e instanceof Error ? e.message : String(e) });
    }
  }
  return names;
}

/** The pictures of a drop: dragged gallery pictures (or a canvas layer), else files from disk stored in the gallery. */
export async function droppedPictures(e: DragEvent): Promise<string[]> {
  // Both are read before the first await, while the browser still exposes the drag data.
  const files = [...e.dataTransfer.files];
  const names = resolveDropImages(e);
  const dragged = (await names).filter(isPicture);
  return dragged.length ? dragged : storeFiles(files);
}

/** `current` with `added` after it (no repeats), cut to the limit with a notice when some did not fit. */
export function withAttached(current: readonly string[], added: readonly string[]): string[] {
  const next = [...new Set([...current, ...added])];
  if (next.length > AGENT_MAX_ATTACHMENTS) toast({ status: 'warning', title: t('agent.attach.tooMany', { count: AGENT_MAX_ATTACHMENTS }) });
  return next.slice(0, AGENT_MAX_ATTACHMENTS);
}

function Thumb({ name }: { name: string }) {
  const url = findImage(name)?.thumbnailUrl;
  return url ? <img src={url} alt={t('agent.attach.picture')} draggable={false} /> : (
    <span role="img" aria-label={t('agent.attach.picture')}>
      <ImageSquare size={20} />
    </span>
  );
}

/** The paperclip: picks picture files from disk. */
export function AttachButton({ disabled, onPicked }: { disabled: boolean; onPicked: (names: string[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <IconButton type="button" label={t('agent.attach.add')} icon={<Paperclip />} disabled={disabled} onClick={() => input.current?.click()} data-testid="agent-attach" />
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        data-testid="agent-attach-file"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          void storeFiles(files).then((names) => names.length && onPicked(names));
        }}
      />
    </>
  );
}

/** The pictures that will go with the next message, each with a button that takes it off. */
export function AttachedStrip({ names, onRemove }: { names: readonly string[]; onRemove: (name: string) => void }) {
  if (!names.length) return null;
  return (
    <ul className="agent-attached" data-testid="agent-attached">
      {names.map((name) => (
        <li key={name} className="agent-attached__item">
          <Thumb name={name} />
          <IconButton className="agent-attached__remove" size="xs" label={t('agent.attach.remove')} icon={<X />} onClick={() => onRemove(name)} />
        </li>
      ))}
    </ul>
  );
}

/** The pictures a sent message carried. */
export function SentPictures({ names }: { names: readonly string[] }) {
  return (
    <ul className="agent-msg__pictures" data-testid="agent-msg-pictures">
      {names.map((name) => (
        <li key={name}>
          <Thumb name={name} />
        </li>
      ))}
    </ul>
  );
}
