// Toast when an install job finishes or fails (InvokeAI shows these while the Model Manager is open).
import { useEffect, useRef } from 'react';
import type { ModelInstallStatus } from '@/backend';
import { t } from '@/i18n';
import { useModels } from '@/state/models';
import { toast } from '@/state/toasts';

export function useInstallToasts() {
  const jobs = useModels((s) => s.installJobs);
  const seen = useRef<Map<string, ModelInstallStatus> | null>(null);
  useEffect(() => {
    const prev = seen.current;
    const next = new Map(jobs.map((j) => [j.id, j.status]));
    seen.current = next;
    if (!prev) return;
    for (const job of jobs) {
      const before = prev.get(job.id);
      if (before === job.status) continue;
      if (job.status === 'completed') toast({ status: 'success', title: t('models.toast.installed'), description: job.name });
      else if (job.status === 'error') toast({ status: 'error', title: t('models.toast.installFailed'), description: job.error ?? job.source });
    }
  }, [jobs]);
}
