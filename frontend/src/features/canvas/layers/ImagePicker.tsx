// Image slot for reference images: drop a gallery image or upload a file.
import { useRef } from 'react';
import { ImageSquare, UploadSimple, X } from '@phosphor-icons/react';
import { backend, type ImageDTO } from '@/backend';
import { t } from '@/i18n';
import { findImage, useGallery } from '@/state/gallery';
import { autoAddBoardId } from '@/state/invoke';
import { IconButton, ImageDropZone } from '@/ui';

async function upload(file: File): Promise<ImageDTO> {
  const image = await backend.uploadImage(file, { boardId: autoAddBoardId(), category: 'user' });
  useGallery.getState().addImage(image);
  return image;
}

export function ImagePicker({ url, onImage }: { url: string | null; onImage: (image: ImageDTO | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <ImageDropZone
      className="canvas-imgpick"
      label={t('canvas.ref.dropHere')}
      onImages={(names) => {
        const img = findImage(names[0] ?? null);
        if (img) onImage(img);
      }}
      onFiles={(files) => {
        const f = files[0];
        if (f) void upload(f).then(onImage);
      }}
    >
      {url ? (
        <>
          <img src={url} alt="" className="canvas-imgpick__img" draggable={false} />
          <IconButton className="canvas-imgpick__clear" label={t('canvas.ref.clearImage')} icon={<X />} size="xs" variant="solid" onClick={() => onImage(null)} />
        </>
      ) : (
        <button type="button" className="canvas-imgpick__empty" onClick={() => input.current?.click()}>
          <ImageSquare size={22} />
          <span>{t('canvas.ref.dropOrUpload')}</span>
          <UploadSimple size={14} />
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void upload(f).then(onImage);
        }}
      />
    </ImageDropZone>
  );
}
