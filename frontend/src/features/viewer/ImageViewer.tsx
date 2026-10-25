// Center image viewer: toolbar, image (or live progress / comparison), metadata overlay, info line.
import { ImageSquare } from '@phosphor-icons/react';
import { useRef } from 'react';
import { useImage } from '@/features/gallery/useBoardImages';
import { useElementSize } from '@/features/gallery/useElementSize';
import { t } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { useGeneratingItems } from '@/state/generating';
import { EmptyState, Kbd } from '@/ui';
import { CompareView } from './compare/CompareView';
import { FittedImage } from './FittedImage';
import { LiveView } from './LiveView';
import { MetadataPanel } from './metadata/MetadataPanel';
import { useViewerHotkeys } from './useViewerHotkeys';
import { ViewerNav } from './ViewerNav';
import { ViewerToolbar } from './ViewerToolbar';
import { ZoomableImage } from './ZoomableImage';
import './viewer.css';

const PAD = 16;

export function ImageViewer() {
  const viewerName = useGallery((s) => s.viewerImageName);
  const compareName = useGallery((s) => s.compareImageName);
  const showMetadata = useGallery((s) => s.showMetadata);
  const liveId = useGallery((s) => s.viewerLiveItemId);
  // The job chosen in the grid, while it is still being drawn; after that the viewer goes back to the picture.
  const liveItem = useGeneratingItems().find((i) => i.id === liveId);
  const image = useImage(liveItem ? null : viewerName);
  const compareImage = useImage(compareName);
  const stageRef = useRef<HTMLDivElement>(null);
  const stage = useElementSize(stageRef);
  const box = { width: stage.width - 2 * PAD, height: stage.height - 2 * PAD };
  const comparing = Boolean(image && compareImage);
  const still = (image?.mediaType ?? 'image') === 'image';
  useViewerHotkeys(image, comparing);

  let content;
  if (liveItem) content = <LiveView item={liveItem} boxWidth={box.width} boxHeight={box.height} />;
  else if (image && compareImage) content = <CompareView first={image} second={compareImage} />;
  else if (image && still) content = <ZoomableImage image={image} />;
  else if (image)
    // Video and audio keep the plain fitted player: their own controls own the pointer.
    content = (
      <FittedImage
        src={image.mediaType === 'audio' ? image.thumbnailUrl : image.url}
        width={image.width}
        height={image.height}
        boxWidth={box.width}
        boxHeight={box.height}
        video={image.mediaType === 'video' ? { poster: image.thumbnailUrl } : undefined}
        audio={image.mediaType === 'audio' ? image.url : undefined}
        testId="viewer-image"
      />
    );
  else
    content = (
      <EmptyState icon={<ImageSquare size={40} />} title={t('gallery.viewer.empty')} description={t('gallery.viewer.emptyHint')}>
        <span className="vempty__keys">
          <Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd>
        </span>
      </EmptyState>
    );

  return (
    <div className="viewer" data-testid="image-viewer">
      <ViewerToolbar image={image} />
      <div className="viewer__stage" ref={stageRef}>
        {content}
        {!comparing && !liveItem && <ViewerNav imageName={viewerName} />}
        {showMetadata && image && !comparing && <MetadataPanel image={image} />}
      </div>
      <div className="viewer__info" data-testid="viewer-info">
        {image ? (
          <>
            <span>{t('gallery.viewer.dims', { width: image.width, height: image.height })}</span>
            {image.metadata && (
              <>
                <span className="viewer__sep" />
                <span>{image.metadata.modelName}</span>
                <span className="viewer__sep" />
                <span>{t('gallery.viewer.seed', { seed: image.metadata.seed })}</span>
              </>
            )}
            <span className="viewer__spacer" />
            <span className="viewer__name">{image.name}</span>
          </>
        ) : liveItem ? (
          <span>{t('gallery.viewer.dims', { width: liveItem.params.width, height: liveItem.params.height })}</span>
        ) : (
          <span>&nbsp;</span>
        )}
      </div>
    </div>
  );
}
