// The band's view of a tool's last run on the picture: running (with its place in the queue and its progress, and the
// only button that cancels it), its result with what can be done with it, or why it failed; and the settings it used.
import { ClipboardText, Crop, Eye, PencilSimple, Plus, Swap, WarningCircle } from '@phosphor-icons/react';
import { useState } from 'react';
import { t, tCount } from '@/i18n';
import { toolViewer, useToolBand } from '@/state/imageTools/band';
import { placePoses } from '@/state/imageTools/posePlacer';
import { applyDescription, cancelToolRun, type ToolRun } from '@/state/imageTools/runs';
import { TOOL_TEXT } from '@/state/imageTools/text';
import { useGallery } from '@/state/gallery';
import { useQueue } from '@/state/queue';
import { toast } from '@/state/toasts';
import { trimTransparent } from '@/state/trim';
import { Button, ProgressBar, Spinner, Textarea, writeClipboardText } from '@/ui';
import { usedSummary } from './usedSummary';

function Running({ run }: { run: ToolRun }) {
  const progress = useQueue((s) => (run.queueItemId !== null && s.progress?.itemId === run.queueItemId ? s.progress : null));
  const waiting = useQueue((s) => s.items.find((i) => i.id === run.queueItemId)?.status === 'pending');
  const text = TOOL_TEXT[run.tool];
  return (
    <>
      <span className="toolband__state" data-testid="tool-band-status" data-status="running">
        <Spinner size={14} /> {waiting ? t('queue.status.pending') : t(text.running)}
      </span>
      <ProgressBar
        className="toolband__progress"
        label={t(text.running)}
        value={progress ? progress.step / Math.max(1, progress.totalSteps) : 0}
        indeterminate={!progress}
      />
      <span className="toolband__hint">{t(text.firstRun)}</span>
      <Button variant="outline" onClick={() => cancelToolRun(run.tool)} data-testid="tool-band-cancel">
        {t('common.cancel')}
      </Button>
    </>
  );
}

function PictureResult({ run, name, compare }: { run: ToolRun; name: string; compare: boolean }) {
  const comparing = useGallery((s) => s.compareImageName === run.imageName && s.viewerImageName === name);
  const background = run.used.tool === 'cutout' ? run.used.background : null;
  const result = run.result?.kind === 'picture' ? run.result.image : null;
  return (
    <>
      <span className="toolband__state" data-testid="tool-band-status" data-status="done">
        {t('gallery.tools.saved')}
      </span>
      {compare && !comparing && (
        <Button leftIcon={<Eye size={14} />} onClick={() => toolViewer().showResult(name, run.imageName)} data-testid="tool-band-compare">
          {t('gallery.tools.compare')}
        </Button>
      )}
      {background === 'alpha' && result && (
        <Button leftIcon={<Crop size={14} />} onClick={() => void trimTransparent(result)} data-testid="tool-band-trim">
          {t('cutout.trim')}
        </Button>
      )}
    </>
  );
}

function DescriptionResult({ run, text: first }: { run: ToolRun; text: string }) {
  // Keyed by the run in the band, so a new description replaces what was edited of the last one.
  const [text, setText] = useState(first);
  const copy = async () => {
    try {
      await writeClipboardText(text.trim());
      toast({ status: 'success', title: t('caption.copied') });
    } catch {
      toast({ status: 'error', title: t('caption.copyFailed') });
    }
  };
  return (
    <div className="toolband__text" data-testid="tool-band-status" data-status="done" data-run={run.id}>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} aria-label={t('caption.result')} data-testid="tool-band-text" />
      <div className="toolband__actions">
        <Button variant="solid" leftIcon={<Swap size={14} />} disabled={!text.trim()} onClick={() => applyDescription(text, 'replace')} data-testid="tool-band-replace">
          {t('caption.replace')}
        </Button>
        <Button variant="outline" leftIcon={<Plus size={14} />} disabled={!text.trim()} onClick={() => applyDescription(text, 'append')} data-testid="tool-band-append">
          {t('caption.append')}
        </Button>
        <Button variant="ghost" leftIcon={<ClipboardText size={14} />} disabled={!text.trim()} onClick={() => void copy()} data-testid="tool-band-copy">
          {t('caption.copy')}
        </Button>
      </div>
    </div>
  );
}

function PosesResult({ run }: { run: ToolRun }) {
  const poses = run.result?.kind === 'poses' ? run.result.poses : null;
  if (!poses) return null;
  const place = (add: boolean) => {
    if (placePoses(poses, add)) toast({ status: 'success', title: t('canvas.poseFromImage.placed') });
  };
  if (!poses.people.length)
    return (
      <span className="toolband__state" data-testid="tool-band-status" data-status="done">
        {t('canvas.poseFromImage.none')}
      </span>
    );
  return (
    <>
      <span className="toolband__state" data-testid="tool-band-status" data-status="done">
        {tCount('canvas.poseFromImage.found', poses.people.length)}
      </span>
      <Button variant="solid" onClick={() => place(false)} data-testid="tool-band-place">
        {t('canvas.poseFromImage.replace')}
      </Button>
      <Button variant="outline" onClick={() => place(true)} data-testid="tool-band-add-poses">
        {t('canvas.poseFromImage.add')}
      </Button>
    </>
  );
}

function Ended({ run, compare }: { run: ToolRun; compare: boolean }) {
  if (run.status === 'failed')
    return (
      <span className="toolband__error" role="alert" data-testid="tool-band-status" data-status="failed">
        <WarningCircle size={14} /> {t(TOOL_TEXT[run.tool].failed)}: {run.error}
      </span>
    );
  if (run.status === 'canceled')
    return (
      <span className="toolband__state" data-testid="tool-band-status" data-status="canceled">
        {t('gallery.tools.canceled')}
      </span>
    );
  const result = run.result;
  if (!result) return null;
  if (result.kind === 'picture') return <PictureResult run={run} name={result.image.name} compare={compare} />;
  if (result.kind === 'text') return <DescriptionResult key={run.id} run={run} text={result.text} />;
  return <PosesResult run={run} />;
}

export function ToolRunView({ run, compare }: { run: ToolRun; compare: boolean }) {
  const used = usedSummary(run.used);
  return (
    <>
      {run.status === 'running' ? <Running run={run} /> : <Ended run={run} compare={compare} />}
      {used.length > 0 && (
        <span className="toolband__used" title={t('gallery.tools.used')} data-testid="tool-band-used">
          {used.join(' · ')}
        </span>
      )}
      {run.status !== 'running' && (
        <Button className="toolband__action" variant="ghost" leftIcon={<PencilSimple size={14} />} onClick={() => useToolBand.getState().setMode('settings')} data-testid="tool-band-edit">
          {t('gallery.tools.edit')}
        </Button>
      )}
    </>
  );
}
