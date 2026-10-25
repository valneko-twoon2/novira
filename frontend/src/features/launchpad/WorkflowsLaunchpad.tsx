// Launchpad of the Workflows tab: new / library / load, and recent workflows.
import { FilePlus, FolderOpen, Books, FlowArrow } from '@phosphor-icons/react';
import { useRef } from 'react';
import type { SavedWorkflow } from '@/backend';
import { t } from '@/i18n';
import { useUi } from '@/state/ui';
import { useWorkflows } from '@/state/workflows/workflows';
import { VideoGuide } from '@/features/workflows/VideoGuide';
import { LaunchpadCard, LaunchpadPage } from './LaunchpadCard';

const RECENT_LIMIT = 6;

function openWorkflow(w: SavedWorkflow) {
  useWorkflows.getState().loadWorkflow(w.graph, w.name);
  useUi.getState().setMainView('workflows', 'editor');
}

export function WorkflowsLaunchpad() {
  const library = useWorkflows((s) => s.library);
  const recent = [...library].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, RECENT_LIMIT);
  const ui = useUi.getState;
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <LaunchpadPage title={t('params.launchpad.workflows.title')} tips={<VideoGuide />}>
      <LaunchpadCard
        icon={<FilePlus />}
        title={t('params.launchpad.workflows.newTitle')}
        onClick={() => ui().setMainView('workflows', 'editor')}
        testId="lp-new-workflow"
      />
      <LaunchpadCard
        icon={<Books />}
        title={t('params.launchpad.workflows.libraryTitle')}
        onClick={() => ui().openModal('workflowLibrary')}
      />
      <LaunchpadCard
        icon={<FolderOpen />}
        title={t('params.launchpad.workflows.loadTitle')}
        onClick={() => fileRef.current?.click()}
        testId="lp-load-workflow"
      />
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        data-testid="lp-load-workflow-file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) useWorkflows.getState().loadFile(file);
        }}
      />
      {recent.length > 0 && (
        <section className="lp-recent">
          <h2 className="lp-recent__title">{t('params.launchpad.workflows.recent')}</h2>
          <ul className="lp-recent__list">
            {recent.map((w) => (
              <li key={w.id}>
                <button type="button" className="lp-recent__item" onClick={() => openWorkflow(w)}>
                  <FlowArrow size={16} />
                  <span className="lp-recent__name">{w.name}</span>
                  <span className="lp-recent__desc">{w.description}</span>
                  <span className="lp-recent__date">{new Date(w.updatedAt).toLocaleDateString()}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </LaunchpadPage>
  );
}
