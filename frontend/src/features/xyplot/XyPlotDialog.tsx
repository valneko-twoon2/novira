// "Comparison grid": the Generate form's settings are drawn once for every combination of two varying settings (same
// seed), and the pictures are put in one labelled table that is saved to the gallery.
import { Eye, WarningCircle } from '@phosphor-icons/react';
import { useMemo, useRef, useState } from 'react';
import { backend, SCHEDULERS, type ImageDTO } from '@/backend';
import { t } from '@/i18n';
import { runJob } from '@/state/comfy/runGraph';
import { useXyPlotDialog } from '@/state/dialogs/xyplot';
import { useGallery } from '@/state/gallery';
import { autoAddBoardId, buildRequestFor, useReadiness } from '@/state/invoke';
import { drawableModels, findModel, useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { toast } from '@/state/toasts';
import { showViewer } from '@/state/ui';
import { AXIS_DEFAULTS, MAX_AXIS_VALUES, MAX_CELLS, NO_AXIS, buildCells, gridProblem, gridSize, parseAxisValues, valueLabel, type Axis } from '@/state/xyplot';
import { Button, Modal, Spinner } from '@/ui';
import { AxisEditor, type AxisInput, type ChoiceOption } from './AxisEditor';
import { drawGrid } from './drawGrid';
import './xyplot.css';

const EMPTY: AxisInput = { kind: null, text: '', choices: [] };

/** The axis an input describes, and what is wrong with its text. */
function readAxis(input: AxisInput): { axis: Axis; error: string | null } {
  const { kind } = input;
  if (!kind) return { axis: NO_AXIS, error: null };
  if (kind === 'scheduler' || kind === 'model') return { axis: { kind, values: input.choices }, error: null };
  const parsed = parseAxisValues(kind, input.text);
  const error = parsed.error === null ? null : parsed.error === 'tooMany' ? t('xyplot.error.tooMany', { max: MAX_AXIS_VALUES }) : t(`xyplot.error.${parsed.error}`);
  return { axis: { kind, values: parsed.values }, error };
}

function loadPicture(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https?:/.test(url)) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = url;
  });
}

export function XyPlotDialog() {
  const isOpen = useXyPlotDialog((s) => s.isOpen);
  const close = useXyPlotDialog((s) => s.close);
  const models = useModels((s) => s.models);
  const readiness = useReadiness('generate');
  const modelKey = useParams((s) => s.modelKey);

  const [xInput, setXInput] = useState<AxisInput>(EMPTY);
  const [yInput, setYInput] = useState<AxisInput>(EMPTY);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [failedCells, setFailedCells] = useState(0);
  const [result, setResult] = useState<ImageDTO | null>(null);
  const abort = useRef<AbortController | null>(null);

  // A kind chosen for the first time starts with a sensible list of values.
  const change = (set: (i: AxisInput) => void) => (next: AxisInput, previous: AxisInput) => {
    const kind = next.kind;
    const text = kind && kind !== previous.kind && kind !== 'scheduler' && kind !== 'model' ? AXIS_DEFAULTS[kind] : next.text;
    set({ ...next, text });
  };
  const changeX = change(setXInput);
  const changeY = change(setYInput);

  const x = readAxis(xInput);
  const y = readAxis(yInput);
  const problem = gridProblem(x.axis, y.axis);
  const size = gridSize(x.axis, y.axis);

  const options = useMemo(() => {
    const current = findModel(modelKey ?? '');
    const sameFamily = drawableModels(models).filter((m) => !current || m.base === current.base);
    return {
      scheduler: SCHEDULERS.map((s): ChoiceOption => ({ value: s, label: s })),
      model: sameFamily.map((m): ChoiceOption => ({ value: m.key, label: m.name })),
    };
  }, [models, modelKey]);

  const run = async () => {
    if (problem || x.error || y.error) return;
    const controller = new AbortController();
    abort.current = controller;
    setRunning(true);
    setProgress(0);
    setError(null);
    setFailedCells(0);
    setResult(null);
    try {
      const base = await buildRequestFor('generate');
      if (!base) throw new Error(t('xyplot.notReady'));
      const cells = buildCells(base, x.axis, y.axis);
      const settled = await Promise.allSettled(
        cells.map((cell) =>
          runJob(cell.request, controller.signal).then((image) => {
            setProgress((p) => p + 1);
            return image;
          }),
        ),
      );
      if (controller.signal.aborted) return;
      const images = await Promise.all(settled.map((r) => (r.status === 'fulfilled' ? loadPicture(r.value.url).catch(() => null) : null)));
      const first = images.find((i): i is HTMLImageElement => !!i);
      if (!first) {
        const rejected = settled.find((r): r is PromiseRejectedResult => r.status === 'rejected');
        throw rejected?.reason instanceof Error ? rejected.reason : new Error(t('xyplot.failed'));
      }
      setFailedCells(images.filter((i) => !i).length);
      const model = findModel(cells[0]!.request.params.modelKey)?.name ?? cells[0]!.request.params.modelName;
      const blob = await drawGrid({
        columns: size.columns,
        rows: size.rows,
        images,
        picture: { width: first.naturalWidth, height: first.naturalHeight },
        title: t('xyplot.gridTitle', {
          x: x.axis.kind ? t(`xyplot.axis.${x.axis.kind}`) : t('xyplot.unused'),
          y: y.axis.kind ? t(`xyplot.axis.${y.axis.kind}`) : t('xyplot.unused'),
          model,
          seed: cells[0]!.request.params.seed,
        }),
        columnLabels: x.axis.kind ? x.axis.values.map((v) => valueLabel(x.axis.kind!, v)) : [],
        rowLabels: y.axis.kind ? y.axis.values.map((v) => valueLabel(y.axis.kind!, v)) : [],
      });
      const saved = await backend.uploadImage(blob, { boardId: base.boardId ?? autoAddBoardId(), category: 'general' });
      useGallery.getState().addImage(saved);
      setResult(saved);
      toast({ status: 'success', title: t('xyplot.done') });
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      abort.current = null;
      setRunning(false);
    }
  };

  const open = () => {
    if (!result) return;
    useGallery.getState().setSelection([result.name]);
    showViewer();
    close();
  };

  const problemText = problem ? t(`xyplot.problem.${problem}`, { max: MAX_CELLS }) : null;
  return (
    <Modal open={isOpen} onOpenChange={(o) => !o && !running && close()} size="lg" closeLabel={t('common.close')} title={t('xyplot.title')}>
      <div className="xyp" data-testid="xyplot-dialog">
        <p className="xyp__hint">{t('xyplot.hint')}</p>
        <div className="xyp__axes">
          <AxisEditor title={t('xyplot.x')} testId="xyplot-x" input={xInput} onChange={(n) => changeX(n, xInput)} options={options} error={x.error} disabled={running} />
          <AxisEditor title={t('xyplot.y')} testId="xyplot-y" input={yInput} onChange={(n) => changeY(n, yInput)} options={options} error={y.error} disabled={running} />
        </div>
        {problemText ? (
          <p className="xyp__hint" data-testid="xyplot-problem">
            {problemText}
          </p>
        ) : (
          <p className="xyp__summary" data-testid="xyplot-summary">
            {t('xyplot.summary', { columns: size.columns, rows: size.rows, count: size.cells })}
          </p>
        )}
        {readiness.length > 0 && (
          <p className="xyp__error" role="alert">
            <WarningCircle size={14} /> {t('xyplot.notReady')} {readiness.join(' / ')}
          </p>
        )}
        {error && (
          <p className="xyp__error" role="alert">
            <WarningCircle size={14} /> {t('xyplot.failed')}: {error}
          </p>
        )}
        {result && (
          <div className="xyp__result" data-testid="xyplot-done">
            <img src={result.url} alt="" draggable={false} />
            {failedCells > 0 && <p className="xyp__hint">{t('xyplot.partFailed', { count: failedCells })}</p>}
            <Button leftIcon={<Eye size={14} />} onClick={open} data-testid="xyplot-open">
              {t('xyplot.open')}
            </Button>
          </div>
        )}
        <div className="xyp__actions">
          {running && (
            <Button variant="outline" onClick={() => abort.current?.abort()} data-testid="xyplot-cancel">
              {t('common.cancel')}
            </Button>
          )}
          <Button variant="solid" scheme="invoke" disabled={running || !!problem || !!x.error || !!y.error || readiness.length > 0} onClick={() => void run()} data-testid="xyplot-run">
            {running ? (
              <>
                <Spinner size={14} /> {t('xyplot.running', { done: progress, total: size.cells })}
              </>
            ) : (
              t('xyplot.run')
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
