// "Redraw the selection": a text prompt and a model redraw only the selected part, the rest of the picture stays.
import { MagicWand } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { randomSeed, type ImageDTO } from '@/backend';
import { t } from '@/i18n';
import { graphRequest } from '@/state/comfy/graphJob';
import { checkpointModels, useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { toast } from '@/state/toasts';
import { Button, Select, SliderNumber, Textarea } from '@/ui';
import { buildRedrawGraph } from './segmentGraph';
import { showResult } from './showResult';
import { runJob } from './segmentJob';

const STEPS = 28;
const CFG = 6;

export function RedrawPanel({ image, maskName, invert, disabled, onDone }: { image: ImageDTO; maskName: string; invert: boolean; disabled?: boolean; onDone: () => void }) {
  const all = useModels((s) => s.models);
  const models = useMemo(() => checkpointModels(all), [all]);
  const preferred = useParams((s) => s.modelKey);
  const negative = useParams((s) => s.negativePrompt);
  const [modelKey, setModelKey] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [strength, setStrength] = useState(1);
  const [running, setRunning] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const chosen = models.find((m) => m.key === modelKey) ?? models.find((m) => m.key === preferred) ?? models[0];

  useEffect(() => () => abort.current?.abort(), []);

  const run = async () => {
    if (!chosen || !prompt.trim()) return;
    const controller = new AbortController();
    abort.current = controller;
    setRunning(true);
    try {
      const graph = buildRedrawGraph(image.name, maskName, { modelKey: chosen.key, prompt: prompt.trim(), negative, strength, invert });
      const result = await runJob(
        graphRequest(graph, 'gallery', image.boardId, {
          generationMode: 'graph',
          positivePrompt: prompt.trim(),
          negativePrompt: negative,
          modelKey: chosen.key,
          modelName: chosen.name,
          seed: randomSeed(),
          steps: STEPS,
          cfgScale: CFG,
          scheduler: 'dpmpp_2m_k',
          width: image.width,
          height: image.height,
          strength,
        }),
        controller.signal,
      );
      showResult(result.name, image.name);
      toast({ status: 'success', title: t('segment.redraw.done') });
      onDone();
    } catch (e) {
      if (!controller.signal.aborted) toast({ status: 'error', title: t('segment.failed'), description: e instanceof Error ? e.message : String(e) });
    } finally {
      abort.current = null;
      setRunning(false);
    }
  };

  return (
    <div className="seg__redraw" data-testid="seg-redraw">
      <strong>{t('segment.redraw.title')}</strong>
      <p className="seg__hint">{t('segment.redraw.hint')}</p>
      {chosen ? (
        <>
          <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t('segment.redraw.prompt')} aria-label={t('segment.redraw.prompt')} rows={3} disabled={running} data-testid="seg-redraw-prompt" />
          <Select value={chosen.key} onChange={setModelKey} options={models.map((m) => ({ value: m.key, label: m.name }))} disabled={running} aria-label={t('segment.redraw.model')} />
          <label className="seg__row2">
            <span>{t('segment.redraw.strength')}</span>
            <SliderNumber value={strength} onChange={setStrength} min={0.3} max={1} step={0.05} precision={2} disabled={running} aria-label={t('segment.redraw.strength')} />
          </label>
          <div className="seg__row">
            <Button leftIcon={<MagicWand size={14} />} isLoading={running} disabled={disabled || running || !prompt.trim()} onClick={() => void run()} data-testid="seg-redraw-run">
              {running ? t('segment.redraw.running') : t('segment.redraw.run')}
            </Button>
            {running && (
              <Button variant="outline" onClick={() => abort.current?.abort()} data-testid="seg-redraw-cancel">
                {t('common.cancel')}
              </Button>
            )}
          </div>
        </>
      ) : (
        <p className="seg__hint">{t('segment.redraw.noModel')}</p>
      )}
    </div>
  );
}
