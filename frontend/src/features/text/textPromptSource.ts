// The Generate screen's prompt boxes on the Text screen: they read and write the words of the AI fill, not the image form's prompts.
import { useMemo } from 'react';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import type { PromptSource } from '@/state/prompts/promptSource';
import { useRichForm } from '@/state/text/richForm';
import { richPlan } from './richRequest';

const field = (kind: 'positive' | 'negative') => (kind === 'positive' ? 'words' : 'negative');

export const textPromptSource: PromptSource = {
  useText: (kind) => useRichForm((s) => s.form[field(kind)]),
  get: (kind) => useRichForm.getState().form[field(kind)],
  set: (kind, text) => useRichForm.getState().setForm({ [field(kind)]: text }),
  useModel: () => {
    const models = useModels((s) => s.models);
    const chosen = useRichForm((s) => s.form.modelKey);
    const generateKey = useParams((s) => s.modelKey);
    return useMemo(() => richPlan(models, chosen, generateKey).model ?? undefined, [models, chosen, generateKey]);
  },
  generateTools: false,
};
