// Models of the given types that are compatible with the selected main model's base.
import { useMemo } from 'react';
import type { ModelConfig, ModelType } from '@/backend';
import { BASE_LABELS, findModel, modelsOfType, useModels } from '@/state/models';
import { useParams } from '@/state/params';
import type { SelectOption } from '@/ui';

export function useCompatibleModels(types: ModelType[]): { models: ModelConfig[]; options: SelectOption[] } {
  const all = useModels((s) => s.models);
  const mainKey = useParams((s) => s.modelKey);
  return useMemo(() => {
    const base = findModel(mainKey)?.base ?? null;
    const models = types.flatMap((type) => modelsOfType(all, type, base));
    const options = models.map((m) => ({ value: m.key, label: m.name, group: BASE_LABELS[m.base] }));
    return { models, options };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, mainKey, types.join('|')]);
}
