// Drop targets shown while an image is dragged over the canvas (InvokeAI "drop to create" tiles).
import { useEffect, useState, type DragEvent, type ReactNode } from 'react';
import { Image, ImageSquare, Selection, Sliders, UsersThree } from '@phosphor-icons/react';
import { backend, type ImageDTO } from '@/backend';
import { t } from '@/i18n';
import { hasDragImages, isImageDrag, resolveDropImages } from '@/state/dnd';
import { findImage, useGallery } from '@/state/gallery';
import { autoAddBoardId } from '@/state/invoke';
import { useCanvasStoreApi } from '@/state/canvasStoreContext';
import { toast } from '@/state/toasts';
import { cx } from '@/ui';
import { addGlobalRefImage, importImage } from '../actions';

type Target = 'raster' | 'control' | 'inpaint' | 'regional' | 'global';

const TARGETS: { id: Target; icon: ReactNode; label: () => string }[] = [
  { id: 'raster', icon: <Image />, label: () => t('canvas.drop.raster') },
  { id: 'control', icon: <Sliders />, label: () => t('canvas.drop.control') },
  { id: 'inpaint', icon: <Selection />, label: () => t('canvas.drop.inpaint') },
  { id: 'regional', icon: <UsersThree />, label: () => t('canvas.drop.regional') },
  { id: 'global', icon: <ImageSquare />, label: () => t('canvas.drop.global') },
];

async function resolveImages(e: DragEvent): Promise<ImageDTO[]> {
  const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
  const names = await resolveDropImages(e);
  if (names.length) return names.map((n) => findImage(n)).filter((i): i is ImageDTO => !!i);
  const out: ImageDTO[] = [];
  for (const f of files) {
    const image = await backend.uploadImage(f, { boardId: autoAddBoardId(), category: 'user' });
    useGallery.getState().addImage(image);
    out.push(image);
  }
  return out;
}

export function CanvasDropTargets({ host }: { host: HTMLElement | null }) {
  const [active, setActive] = useState(false);
  const [over, setOver] = useState<Target | null>(null);
  const store = useCanvasStoreApi();

  useEffect(() => {
    if (!host) return;
    const enter = (e: globalThis.DragEvent) => {
      if (hasDragImages(e.dataTransfer?.types ?? [])) setActive(true);
    };
    const end = () => {
      setActive(false);
      setOver(null);
    };
    host.addEventListener('dragenter', enter);
    window.addEventListener('dragend', end);
    window.addEventListener('drop', end);
    return () => {
      host.removeEventListener('dragenter', enter);
      window.removeEventListener('dragend', end);
      window.removeEventListener('drop', end);
    };
  }, [host]);

  if (!active) return null;

  const onDrop = async (e: DragEvent, target: Target) => {
    e.preventDefault();
    setActive(false);
    setOver(null);
    try {
      const images = await resolveImages(e);
      if (!images.length) return;
      for (const image of images) {
        if (target === 'global') addGlobalRefImage(image);
        else importImage(image, target, store);
      }
    } catch (err) {
      toast({ status: 'error', title: t('canvas.toast.importFailed'), description: String(err instanceof Error ? err.message : err) });
    }
  };

  return (
    <div
      className="canvas-drop"
      data-testid="canvas-drop"
      onDragOver={(e) => isImageDrag(e) && e.preventDefault()}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setActive(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setActive(false);
      }}
    >
      {TARGETS.map((x) => (
        <div
          key={x.id}
          className={cx('canvas-drop__target', over === x.id && 'is-over')}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            if (over !== x.id) setOver(x.id);
          }}
          onDragLeave={() => setOver((o) => (o === x.id ? null : o))}
          onDrop={(e) => {
            e.stopPropagation();
            void onDrop(e, x.id);
          }}
        >
          <span className="canvas-drop__icon">{x.icon}</span>
          <span>{x.label()}</span>
        </div>
      ))}
    </div>
  );
}
