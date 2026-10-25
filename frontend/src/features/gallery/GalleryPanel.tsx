// Right column: boards list, gallery toolbar and the virtualized image grid (InvokeAI v6 gallery).
import { useRef, useState, type DragEvent } from 'react';
import { t } from '@/i18n';
import type { TabName } from '@/state/ui';
import { useGallery } from '@/state/gallery';
import { cx } from '@/ui';
import { uploadFiles } from './actions';
import { BoardsSection } from './boards/BoardsSection';
import { DeleteImagesModal } from './DeleteImagesModal';
import { GeneratingStrip } from './GeneratingStrip';
import './gallery.css';
import { ImageGrid } from './grid/ImageGrid';
import { GalleryHeader } from './header/GalleryHeader';

export function GalleryPanel({ tab = 'generate' }: { tab?: TabName }) {
  const view = useGallery((s) => s.view);
  const fileRef = useRef<HTMLInputElement>(null);
  const openPicker = () => fileRef.current?.click();
  const [over, setOver] = useState(false);
  // Only OS files are uploaded here; gallery image drags go to the boards instead.
  const onDragOver = (e: DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setOver(true);
  };
  return (
    <div className="panel gpanel" data-testid="gallery-panel">
      <BoardsSection />
      <div
        className={cx('gpanel__gallery', over && 'is-over')}
        onDragOver={onDragOver}
        onDragEnter={onDragOver}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
        }}
        onDrop={(e) => {
          if (!e.dataTransfer.types.includes('Files')) return;
          e.preventDefault();
          setOver(false);
          void uploadFiles([...e.dataTransfer.files]);
        }}
      >
        <GalleryHeader onUploadClick={openPicker} />
        {view === 'images' && <GeneratingStrip />}
        <ImageGrid tab={tab} onUploadClick={openPicker} />
        {over && <div className="gpanel__drop">{t('gallery.dropToUpload')}</div>}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length) void uploadFiles(files);
        }}
      />
      <DeleteImagesModal />
    </div>
  );
}
