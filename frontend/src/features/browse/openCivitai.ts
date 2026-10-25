// Opens a model's page on civitai.com or huggingface.co in the system browser; the mock has no browser, so it only reports it.
import { backend, type ModelSource } from '@/backend';
import { t } from '@/i18n';
import { toast } from '@/state/toasts';

export function openOnCivitai(model: { id: string; name: string; source?: ModelSource }): void {
  if (backend.kind === 'mock') {
    toast({ status: 'info', title: t('browse.toast.openMock'), description: model.name }, 2200);
    return;
  }
  const open = model.source === 'huggingface' ? backend.openHuggingFacePage(model.id) : backend.openCivitaiPage(model.id);
  open.catch((e: unknown) => {
    toast({ status: 'error', title: t('browse.toast.openFailed'), description: e instanceof Error ? e.message : String(e) });
  });
}
