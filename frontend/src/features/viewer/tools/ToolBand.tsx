// The tool band over the viewer's picture: a switch between the picture tools, the chosen tool's settings and Run
// button, or its last run on the picture (running, the result, the failure) with "change the settings and run again".
// The picture stays in the viewer, so it can be zoomed and compared. Closing the band leaves a running job running.
import { ChatCenteredText, PersonSimple, Play, Scissors, Smiley, WarningCircle, X } from '@phosphor-icons/react';
import { useEffect, type ReactNode } from 'react';
import { t } from '@/i18n';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { loadToolNodes } from '@/state/imageTools/actions';
import { useToolBand } from '@/state/imageTools/band';
import { toolReadiness } from '@/state/imageTools/readiness';
import { madeByToolRun, startToolRun, useToolRuns } from '@/state/imageTools/runs';
import { TOOL_TEXT } from '@/state/imageTools/text';
import { IMAGE_TOOLS, type ImageToolId } from '@/state/imageTools/tools';
import { findImage, useGallery } from '@/state/gallery';
import { useModels } from '@/state/models';
import { Button, cx, ErrorBoundary, IconButton, Spinner } from '@/ui';
import { PackNeeds } from './PackNeeds';
import { ToolFields } from './ToolFields';
import { ToolRunView } from './ToolRunView';
import './toolBand.css';

const ICONS: Record<ImageToolId, ReactNode> = {
  facefix: <Smiley size={14} />,
  cutout: <Scissors size={14} />,
  caption: <ChatCenteredText size={14} />,
  pose: <PersonSimple size={14} />,
};

/**
 * `shown` is the picture the layout shows now (null while it compares two): the band follows it to another picture,
 * but not to the result of its own run. `tools` leaves out what a layout cannot use (the phone has no canvas for poses);
 * `compare` says whether the layout can show a result beside its original.
 */
export function ToolBand({ shown, tools = IMAGE_TOOLS, compare = true }: { shown: string | null; tools?: readonly ImageToolId[]; compare?: boolean }) {
  const open = useToolBand((s) => s.open);
  if (!open) return null;
  return (
    <ErrorBoundary area="tool band">
      <Band shown={shown} tools={tools} compare={compare} />
    </ErrorBoundary>
  );
}

function Band({ shown, tools, compare }: { shown: string | null; tools: readonly ImageToolId[]; compare: boolean }) {
  const tool = useToolBand((s) => s.tool);
  const imageName = useToolBand((s) => s.imageName);
  const mode = useToolBand((s) => s.mode);
  const run = useToolRuns((s) => s.runs[tool]);
  const image = useGallery((s) => (imageName ? s.images.find((i) => i.name === imageName) : undefined));
  const defs = useComfyNodes((s) => s.defs);
  const status = useComfyNodes((s) => s.status);
  const models = useModels((s) => s.models);

  useEffect(() => {
    void loadToolNodes();
  }, []);

  // The viewer moved to another still picture: the tools act on that one now. A tool's own result is not another
  // picture to act on: the gallery may show it on its own as soon as it is saved.
  useEffect(() => {
    if (!shown || shown === imageName || madeByToolRun(shown)) return;
    if ((findImage(shown)?.mediaType ?? 'image') !== 'image') return;
    useToolBand.getState().retarget(shown);
  }, [shown, imageName]);

  const readiness = toolReadiness(tool, { defs, status, models });
  const ownRun = run && run.imageName === imageName ? run : undefined;
  const running = ownRun?.status === 'running';

  let body: ReactNode;
  if (!image) body = null;
  else if (mode === 'status' && ownRun) body = <ToolRunView run={ownRun} compare={compare} />;
  else if (readiness.state === 'loading')
    body = (
      <span className="toolband__state" data-testid="tool-band-loading">
        <Spinner size={14} /> {t('gallery.tools.loading')}
      </span>
    );
  else if (readiness.state === 'needsPack') body = <PackNeeds pack={readiness.pack} message={readiness.message} />;
  else if (readiness.state === 'problem')
    body = (
      <span className="toolband__error" role="alert" data-testid="tool-band-problem">
        <WarningCircle size={14} /> {t(readiness.message)}
      </span>
    );
  else
    body = (
      <>
        <ToolFields tool={tool} image={image} />
        <Button
          variant="solid"
          scheme="invoke"
          leftIcon={<Play size={14} weight="fill" />}
          disabled={running}
          onClick={() => {
            useToolBand.getState().setMode('status');
            void startToolRun(tool, image.name);
          }}
          data-testid="tool-band-run"
        >
          {t('gallery.tools.run')}
        </Button>
      </>
    );

  return (
    <section className="toolband" aria-label={t('gallery.tools.band')} data-testid="tool-band" data-tool={tool}>
      <div className="toolband__switch" role="radiogroup" aria-label={t('gallery.tools.band')}>
        {tools.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={tool === id}
            className={cx('toolband__tool', tool === id && 'is-active')}
            data-testid={`tool-band-tool-${id}`}
            onClick={() => useToolBand.getState().setTool(id)}
          >
            {ICONS[id]}
            <span>{t(TOOL_TEXT[id].name)}</span>
          </button>
        ))}
      </div>
      <div className="toolband__body">{body}</div>
      <IconButton size="sm" className="toolband__close" label={t('common.close')} icon={<X />} onClick={() => useToolBand.getState().close()} data-testid="tool-band-close" />
    </section>
  );
}
