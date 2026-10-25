// Metadata overlay of the viewer: recall parameters, raw metadata, image details, workflow.
import { Copy, X } from '@phosphor-icons/react';
import { type RefObject, useEffect, useRef } from 'react';
import type { ImageDTO } from '@/backend';
import { boardName, copyText } from '@/features/gallery/actions';
import { getLocale, t } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { EmptyState, IconButton, Tab, TabList, TabPanel, Tabs } from '@/ui';
import { RecallParameters } from './RecallParameters';

function JsonBlock({ value }: { value: unknown }) {
  const text = JSON.stringify(value, null, 2);
  return (
    <div className="vjson">
      <IconButton className="vjson__copy" label={t('common.copy')} icon={<Copy />} size="xs" onClick={() => void copyText(text)} />
      <pre>{text}</pre>
    </div>
  );
}

function Details({ image }: { image: ImageDTO }) {
  const rows: [string, string][] = [
    [t('common.name'), image.name],
    [t('gallery.details.dimensions'), `${image.width}×${image.height}`],
    [t('gallery.details.created'), new Date(image.createdAt).toLocaleString(getLocale())],
    [t('gallery.details.board'), boardName(image.boardId ?? 'none')],
    [t('gallery.details.category'), image.category],
    [t('gallery.details.starred'), image.starred ? t('common.yes') : t('common.no')],
    [t('gallery.details.intermediate'), image.isIntermediate ? t('common.yes') : t('common.no')],
  ];
  return (
    <div className="vrecall">
      {rows.map(([k, v]) => (
        <div key={k} className="vrecall__row">
          <span className="vrecall__label">{k}</span>
          <span className="vrecall__value">{v}</span>
        </div>
      ))}
    </div>
  );
}

/** Marks the control that toggles the panel (the viewer toolbar's i button), so a press on it is not a press outside. */
const TOGGLE_ATTR = 'data-metadata-toggle';

/**
 * Closes the panel when a primary press starts outside it. Judged where the press starts, so selecting text inside and
 * letting go outside keeps it open; the toggle button is left to its own click.
 */
function useCloseOnPressOutside(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const target = e.target instanceof Element ? e.target : null;
      if (!target || ref.current?.contains(target) || target.closest(`[${TOGGLE_ATTR}]`)) return;
      if (useGallery.getState().showMetadata) useGallery.getState().toggleMetadata();
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [ref]);
}

export function MetadataPanel({ image }: { image: ImageDTO }) {
  const ref = useRef<HTMLDivElement>(null);
  useCloseOnPressOutside(ref);
  return (
    <div ref={ref} className="vmeta" data-testid="viewer-metadata">
      <Tabs defaultValue="recall" className="vmeta__tabs">
        <div className="vmeta__head">
          <TabList>
            <Tab value="recall">{t('gallery.meta.tabRecall')}</Tab>
            <Tab value="metadata">{t('gallery.meta.tabMetadata')}</Tab>
            <Tab value="details">{t('gallery.meta.tabDetails')}</Tab>
            <Tab value="workflow">{t('gallery.meta.tabWorkflow')}</Tab>
          </TabList>
          <IconButton label={t('common.close')} icon={<X />} size="xs" onClick={() => useGallery.getState().toggleMetadata()} />
        </div>
        <TabPanel value="recall" className="vmeta__body">
          <RecallParameters image={image} onCopy={(text) => void copyText(text)} />
        </TabPanel>
        <TabPanel value="metadata" className="vmeta__body">
          {image.metadata ? <JsonBlock value={image.metadata} /> : <EmptyState title={t('gallery.meta.none')} />}
        </TabPanel>
        <TabPanel value="details" className="vmeta__body">
          <Details image={image} />
        </TabPanel>
        <TabPanel value="workflow" className="vmeta__body">
          {image.workflow ? <JsonBlock value={image.workflow} /> : <EmptyState title={t('gallery.meta.noWorkflow')} />}
        </TabPanel>
      </Tabs>
    </div>
  );
}
