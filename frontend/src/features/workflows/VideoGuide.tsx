// Help for making videos in the workflow editor: the steps on the Start page and a notice in the left panel.
import { FilmSlate } from '@phosphor-icons/react';
import { backend } from '@/backend';
import { t } from '@/i18n';
import { formatGb, usePacks } from '@/state/media/packs';
import { useWorkflows } from '@/state/workflows/workflows';
import { Button } from '@/ui';
import { openLibraryWorkflow } from './actions';

function openDefault(id: string) {
  const wf = useWorkflows.getState().library.find((w) => w.id === id);
  if (wf) openLibraryWorkflow(wf);
}

function PackAction() {
  const pack = usePacks((s) => s.packs.video);
  if (pack.state === 'ready') return <span className="wf-guide__ok">{t('video.guide.pack.ready')}</span>;
  if (pack.state === 'downloading') {
    return (
      <span className="wf-guide__ok">
        {t('pack.downloading', { index: pack.index, count: pack.count, done: formatGb(pack.bytes), total: formatGb(pack.totalBytes) })}
      </span>
    );
  }
  return (
    <Button size="xs" variant="solid" scheme="invoke" onClick={() => void backend.installPack('video')} data-testid="guide-video-pack">
      {t('video.guide.pack.download')}
    </Button>
  );
}

/** Numbered steps with the actions each step needs; shown on the Workflows Start page. */
export function VideoGuide() {
  return (
    <section className="wf-guide" data-testid="video-guide">
      <h2 className="wf-guide__title">
        <FilmSlate size={16} /> {t('video.guide.title')}
      </h2>
      <ol className="wf-guide__steps">
        <li>
          {t('video.guide.step1')} <PackAction />
        </li>
        <li>
          {t('video.guide.step2')}
          <span className="wf-guide__buttons">
            <Button size="xs" variant="outline" onClick={() => openDefault('default-video-t2v')} data-testid="guide-open-t2v">
              {t('video.guide.openText')}
            </Button>
            <Button size="xs" variant="outline" onClick={() => openDefault('default-video-i2v')} data-testid="guide-open-i2v">
              {t('video.guide.openImage')}
            </Button>
          </span>
        </li>
        <li>{t('video.guide.step3')}</li>
        <li>{t('video.guide.step4')}</li>
      </ol>
    </section>
  );
}

/** Shown above the left panel while the open graph makes a video and the models are missing. */
export function VideoPanelNotice() {
  const makesVideo = useWorkflows((s) => s.nodes.some((n) => n.data.type === 'video_generate'));
  const pack = usePacks((s) => s.packs.video);
  if (!makesVideo || pack.state === 'ready') return null;
  return (
    <div className="wf-guide wf-guide--notice" data-testid="video-panel-notice">
      <strong>{t('video.panelNotice.title')}</strong>
      <span>{t('video.panelNotice.body')}</span>
      <PackAction />
    </div>
  );
}
