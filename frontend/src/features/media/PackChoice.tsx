// The video screen's "this needs a model" card when the model in use is not downloaded: both video models side by side
// with how well each fits this PC, and a download button on each.
import type { PackKind } from '@/backend';
import { backend } from '@/backend';
import { t } from '@/i18n';
import { useHardware } from '@/state/hardware';
import { formatGb, usePacks } from '@/state/media/packs';
import { Badge, Button } from '@/ui';
import { ModelChoice, type ChoiceItem } from './ModelChoice';
import { fitOf, PACK_NEEDS, recommendedIndex } from './modelFit';

export interface PackOption {
  kind: PackKind;
  name: string;
  /** One line about the model (what it is good at). */
  note: string;
}

/** Nothing once the model in use is installed. */
export function PackChoice({ title, options, selected, onSelect, testId }: { title: string; options: PackOption[]; selected: PackKind; onSelect: (kind: PackKind) => void; testId: string }) {
  const packs = usePacks((s) => s.packs);
  const vram = useHardware((s) => s.info?.vramBytes ?? null);
  if (packs[selected].state === 'ready') return null;
  const fits = options.map((o) => fitOf(vram, PACK_NEEDS[o.kind]));
  const best = recommendedIndex(fits);
  const items: ChoiceItem[] = options.map((o, i) => {
    const pack = packs[o.kind];
    const busy = pack.state === 'downloading' || pack.state === 'installing';
    return {
      id: o.kind,
      name: o.name,
      note: [o.note, pack.state === 'missing' ? t('media.choice.size', { size: formatGb(pack.totalBytes) }) : pack.state === 'error' ? pack.message : ''].filter(Boolean).join(' '),
      fit: fits[i],
      recommended: i === best,
      selected: o.kind === selected,
      onSelect: () => onSelect(o.kind),
      action:
        pack.state === 'ready' ? (
          <Badge scheme="success">{t('media.choice.installed')}</Badge>
        ) : busy ? (
          <Button
            size="xs"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              void backend.cancelPack(o.kind);
            }}
          >
            {pack.state === 'downloading' ? `${Math.round(pack.totalBytes ? (pack.bytes / pack.totalBytes) * 100 : 0)}% · ${t('common.cancel')}` : t('common.cancel')}
          </Button>
        ) : (
          <Button
            size="xs"
            variant="solid"
            scheme="invoke"
            data-testid={`${o.kind}-pack-install`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(o.kind);
              void backend.installPack(o.kind);
            }}
          >
            {t(pack.state === 'error' ? 'pack.retry' : 'pack.install')}
          </Button>
        ),
    };
  });
  return <ModelChoice title={title} items={items} testId={testId} />;
}
