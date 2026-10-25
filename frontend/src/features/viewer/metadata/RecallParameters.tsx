// "Recall Parameters" list: each stored parameter with a button that recalls it alone; the prompts can also be copied.
import { ArrowCounterClockwise, Copy } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { samplingLabel, type GenerationMetadata, type ImageDTO } from '@/backend';
import { t, type MessageKey } from '@/i18n';
import { useModels } from '@/state/models';
import { hiresFromMetadata, useParams, type ParamsFields } from '@/state/params';
import { recalledModel, recalledModelKey, recalledModelNote } from '@/state/recallModel';
import { toast } from '@/state/toasts';
import { EmptyState, IconButton } from '@/ui';

interface Row {
  label: MessageKey;
  value: ReactNode;
  patch?: Partial<ParamsFields> | (() => Partial<ParamsFields>);
  /** Text the copy button puts on the clipboard (the prompts). */
  copy?: string;
  /** The model row: found by key or name (`recalledModel`), and the notification says when it was not found. */
  model?: true;
}

function rows(m: GenerationMetadata, loraName: (key: string) => string): Row[] {
  const out: Row[] = [
    { label: 'gallery.meta.generationMode', value: m.generationMode },
    { label: 'gallery.meta.positivePrompt', value: m.positivePrompt, patch: { positivePrompt: m.positivePrompt }, copy: m.positivePrompt },
  ];
  if (m.negativePrompt) out.push({ label: 'gallery.meta.negativePrompt', value: m.negativePrompt, patch: { negativePrompt: m.negativePrompt }, copy: m.negativePrompt });
  out.push(
    { label: 'gallery.meta.model', value: m.modelName, model: true },
    { label: 'gallery.meta.vae', value: m.vaeKey ?? t('gallery.meta.defaultVae'), patch: { vaeKey: m.vaeKey } },
    { label: 'gallery.meta.seed', value: m.seed, patch: { seed: m.seed, shouldRandomizeSeed: false } },
    { label: 'gallery.meta.steps', value: m.steps, patch: { steps: m.steps } },
    { label: 'gallery.meta.cfgScale', value: m.cfgScale, patch: { cfgScale: m.cfgScale } },
    { label: 'gallery.meta.cfgRescale', value: m.cfgRescale, patch: { cfgRescale: m.cfgRescale } },
    // A model that runs its family's own sampling records it; the scheduler setting it was sent with was not used.
    m.sampling
      ? { label: 'gallery.meta.sampling', value: samplingLabel(m.sampling) }
      : { label: 'gallery.meta.scheduler', value: m.scheduler, patch: { scheduler: m.scheduler } },
    { label: 'gallery.meta.size', value: `${m.width}×${m.height}`, patch: { width: m.width, height: m.height, aspectRatio: 'free' } },
    { label: 'gallery.meta.clipSkip', value: m.clipSkip, patch: { clipSkip: m.clipSkip } },
  );
  if (m.seamlessX || m.seamlessY)
    out.push({ label: 'gallery.meta.seamless', value: [m.seamlessX && 'X', m.seamlessY && 'Y'].filter(Boolean).join(' / '), patch: { seamlessX: m.seamlessX, seamlessY: m.seamlessY } });
  if (m.strength !== undefined) out.push({ label: 'gallery.meta.strength', value: m.strength, patch: { strength: m.strength } });
  const hires = m.hiresFix;
  if (hires) out.push({ label: 'gallery.meta.hiresFix', value: `×${hires.scale} · ${hires.strength}`, patch: () => ({ hires: hiresFromMetadata(hires, useParams.getState().hires) }) });
  for (const l of m.loras) {
    out.push({ label: 'gallery.meta.lora', value: `${loraName(l.key)} (${l.weight})`, patch: () => ({ loras: [...useParams.getState().loras.filter((x) => x.key !== l.key), { ...l }] }) });
  }
  if (m.upscaleScale !== undefined) out.push({ label: 'gallery.meta.upscaleScale', value: `×${m.upscaleScale}` });
  if (m.creativity !== undefined) out.push({ label: 'gallery.meta.creativity', value: m.creativity });
  if (m.structure !== undefined) out.push({ label: 'gallery.meta.structure', value: m.structure });
  if (m.workflowName) out.push({ label: 'gallery.meta.workflow', value: m.workflowName });
  return out;
}

/** `onCopy` puts a prompt on the clipboard (the gallery's copy action, passed in by the panel). */
export function RecallParameters({ image, onCopy }: { image: ImageDTO; onCopy: (text: string) => void }) {
  const models = useModels((s) => s.models);
  const m = image.metadata;
  if (!m) return <EmptyState title={t('gallery.meta.none')} />;
  const loraName = (key: string) => models.find((x) => x.key === key)?.name ?? key;
  return (
    <div className="vrecall" data-testid="recall-parameters">
      {rows(m, loraName).map((r, i) => (
        <div key={`${r.label}-${i}`} className="vrecall__row">
          <span className="vrecall__label">{t(r.label)}</span>
          <span className="vrecall__value">{r.value}</span>
          <span className="vrecall__actions">
            {r.copy !== undefined && (
              <IconButton label={t('gallery.meta.copy', { name: t(r.label) })} icon={<Copy />} size="xs" onClick={() => onCopy(r.copy!)} />
            )}
            {r.patch || r.model ? (
              <IconButton
                label={t('gallery.meta.recall', { name: t(r.label) })}
                icon={<ArrowCounterClockwise />}
                size="xs"
                onClick={() => {
                  const title = t('gallery.meta.recalled', { name: t(r.label) });
                  if (r.model) {
                    const found = recalledModel(m, useModels.getState().models);
                    useParams.getState().set({ modelKey: recalledModelKey(found, useParams.getState().modelKey) });
                    const note = recalledModelNote(found);
                    toast({ status: note?.status ?? 'info', title, ...(note ? { description: note.description } : {}) });
                    return;
                  }
                  const patch = r.patch!;
                  useParams.getState().set(typeof patch === 'function' ? patch() : patch);
                  toast({ status: 'info', title });
                }}
              />
            ) : (
              <span className="vrecall__spacer" />
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
