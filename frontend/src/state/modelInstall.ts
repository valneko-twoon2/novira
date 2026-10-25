// Starting model installs. Progress arrives through backend events (see state/wiring).
import { create } from 'zustand';
import { backend, type ModelConfig, type ModelInstallJob } from '@/backend';
import { t } from '@/i18n';
import { useModels } from '@/state/models';
import { toast } from '@/state/toasts';

/** Sources whose install request is on its way to the backend: they already show as busy, and cannot be asked for again. */
const useStarting = create<{ sources: ReadonlySet<string> }>()(() => ({ sources: new Set<string>() }));

/**
 * Runs the request that starts an install of `source`. While it runs the source counts as installing, and a second request for it
 * is dropped (false). The job it returns goes into the store at once, so the button never falls back to idle before the event comes.
 */
export async function startInstall(source: string, request: () => Promise<ModelInstallJob>): Promise<boolean> {
  if (useStarting.getState().sources.has(source)) return false;
  const mark = (on: boolean) =>
    useStarting.setState((s) => {
      const next = new Set(s.sources);
      if (on) next.add(source);
      else next.delete(source);
      return { sources: next };
    });
  mark(true);
  try {
    useModels.getState().upsertInstallJob(await request());
    return true;
  } finally {
    mark(false);
  }
}

/** Starts an install; false when it did not start (the error is shown as a notification). */
export async function installModel(source: string, name?: string): Promise<boolean> {
  const trimmed = source.trim();
  try {
    if (await startInstall(trimmed, () => backend.installModel(trimmed, name))) {
      toast({ status: 'info', title: t('models.toast.installQueued'), description: name ?? trimmed });
      return true;
    }
  } catch (err) {
    toast({ status: 'error', title: t('models.toast.installFailed'), description: err instanceof Error ? err.message : String(err) });
  }
  return false;
}

/** True when a model with this source is installed or an install for it is running. */
export function sourceState(source: string, models: ModelConfig[], installJobs: ModelInstallJob[]): 'installed' | 'queued' | null {
  if (models.some((m) => m.source === source)) return 'installed';
  if (installJobs.some((j) => j.source === source && (j.status === 'waiting' || j.status === 'downloading' || j.status === 'running'))) return 'queued';
  return null;
}

export type InstallState = { kind: 'idle' } | { kind: 'queued'; progress: number } | { kind: 'installed' };

const ACTIVE: ModelInstallJob['status'][] = ['waiting', 'downloading', 'running'];

/**
 * Install state of one source, for showing progress: installed models match by source (or by `name`, when the caller knows
 * the file's name), and an active install job reports how far its download is (0 to 1; 0 while the size is not known).
 */
export function useInstallState(source: string, name?: string): InstallState {
  const starting = useStarting((s) => s.sources.has(source));
  const installed = useModels((s) => s.models.some((m) => m.source === source || (name !== undefined && m.name === name)));
  const job = useModels((s) => s.installJobs.find((j) => j.source === source));
  if (installed || job?.status === 'completed') return { kind: 'installed' };
  if (job && ACTIVE.includes(job.status)) return { kind: 'queued', progress: job.totalBytes ? job.bytes / job.totalBytes : 0 };
  return starting ? { kind: 'queued', progress: 0 } : { kind: 'idle' };
}
