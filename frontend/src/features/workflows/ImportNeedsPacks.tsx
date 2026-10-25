// Shown when a workflow file needs custom node packs this PC does not have: install them (and restart ComfyUI), and the
// file opens by itself.
import { ArrowClockwise, DownloadSimple, PuzzlePiece } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { packKey, useNodePacks } from '@/state/comfy/nodePacks';
import { useWorkflowImport } from '@/state/workflows/workflowImport';
import { Button, Modal } from '@/ui';

export function ImportNeedsPacks() {
  const pending = useWorkflowImport((s) => s.pending);
  const clear = useWorkflowImport((s) => s.clear);
  const installed = useNodePacks((s) => s.packs?.installed);
  const jobs = useNodePacks((s) => s.jobs);
  const install = useNodePacks((s) => s.install);
  const restart = useNodePacks((s) => s.restart);
  const restarting = useNodePacks((s) => s.restarting);
  const has = (folder: string) => !!installed?.some((p) => p.folder === folder);
  return (
    <Modal open={!!pending} onOpenChange={(open) => !open && clear()} size="md" closeLabel={t('common.close')} title={t('workflows.import.title')}>
      <div className="wf-import" data-testid="wf-import-needs">
        <p>{t('workflows.import.message', { name: pending?.name ?? '' })}</p>
        {pending?.packs.length ? (
          <ul className="wf-import__packs">
            {pending.packs.map((p) => {
              const job = p.url ? jobs[packKey(p.url)] : undefined;
              const busy = job?.state === 'downloading' || job?.state === 'installing';
              return (
                <li key={p.folder} data-testid="wf-import-pack">
                  <span className="wf-import__name">
                    <PuzzlePiece size={14} /> {p.folder}
                  </span>
                  {has(p.folder) ? (
                    <Button size="xs" variant="solid" leftIcon={<ArrowClockwise size={12} />} isLoading={restarting} onClick={() => void restart()} data-testid="wf-import-restart">
                      {t('workflows.import.restart')}
                    </Button>
                  ) : p.url ? (
                    <Button size="xs" variant="solid" leftIcon={<DownloadSimple size={12} />} isLoading={busy} onClick={() => void install(p.url!)} data-testid="wf-import-install">
                      {t('workflows.import.install')}
                    </Button>
                  ) : (
                    <span className="wf-import__hint">{t('workflows.import.unknownSource')}</span>
                  )}
                  {job?.state === 'error' && <p className="wf-packs__error">{job.message}</p>}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="wf-import__hint">{t('workflows.import.unknownPacks')}</p>
        )}
        <p className="wf-import__hint">{t('workflows.import.types', { types: pending?.types.map((x) => x.replace(/^comfy:/, '')).join(', ') ?? '' })}</p>
      </div>
    </Modal>
  );
}
