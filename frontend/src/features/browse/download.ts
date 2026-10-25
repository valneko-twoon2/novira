// Starting Civitai file downloads through the install pipeline, and mapping install jobs to card state.
import { backend, type CivitaiFile, type CivitaiModel, type CivitaiVersion } from '@/backend';
import { t } from '@/i18n';
import { startInstall, useInstallState, type InstallState } from '@/state/modelInstall';
import { toast } from '@/state/toasts';

export const CIVITAI_SOURCE_PREFIX = 'civitai:';

export function fileSource(model: CivitaiModel, file: CivitaiFile): string {
  // Hugging Face: `owner/repo::path/in/repo` (the file id is the path).
  if (model.source === 'huggingface') return `${model.id}::${file.id}`;
  return `${CIVITAI_SOURCE_PREFIX}${model.id}/${file.id}`;
}

export function defaultFile(model: CivitaiModel): CivitaiFile {
  return (model.versions[0] as CivitaiVersion).files[0] as CivitaiFile;
}

export async function downloadFile(model: CivitaiModel, file: CivitaiFile): Promise<void> {
  try {
    const source = fileSource(model, file);
    if (await startInstall(source, () => backend.installModel(source, file.name))) toast({ status: 'info', title: t('browse.toast.queued'), description: file.name });
  } catch (err) {
    toast({ status: 'error', title: t('browse.toast.failed'), description: err instanceof Error ? err.message : String(err) });
  }
}

export type DownloadState = InstallState;

/** Install state of one file: installed models match by source or name; active jobs report progress. */
export const useDownloadState = (source: string, name: string): DownloadState => useInstallState(source, name);
