// The currently selected main model config (reactive to both stores).
import type { ModelConfig } from '@/backend';
import { isDrawable, useModels } from '@/state/models';
import { useParams } from '@/state/params';

export function useMainModel(): ModelConfig | undefined {
  const key = useParams((s) => s.modelKey);
  return useModels((s) => s.models.find((m) => m.key === key && isDrawable(m)));
}
