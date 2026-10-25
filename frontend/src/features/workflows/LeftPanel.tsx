// Left column of the Workflows tab: the Workflow (form) / Nodes / Templates / Extensions / Details / Data tabs, and the workflow dialogs
// (the open workflow and the library are the card above the Generate button, `LibraryCard.tsx`).
import './workflows.css';
import { useState } from 'react';
import { t } from '@/i18n';
import type { TabName } from '@/state/ui';
import { Tab, TabList, TabPanel, Tabs } from '@/ui';
import { DataView } from './DataView';
import { DetailsView } from './DetailsView';
import { PacksView } from './PacksView';
import { TemplatesView } from './TemplatesView';
import { FormView } from './FormView';
import { useInitialWorkflow } from './initialWorkflow';
import { LibraryModal } from './LibraryModal';
import { NodeLibrary } from './NodeLibrary';
import { VideoPanelNotice } from './VideoGuide';
import { WorkflowDialogs } from './WorkflowDialogs';

type PanelTab = 'workflow' | 'nodes' | 'templates' | 'packs' | 'details' | 'data';

export function WorkflowsLeftPanel(_props: { tab?: TabName }) {
  useInitialWorkflow();
  const [tab, setTab] = useState<PanelTab>('workflow');
  return (
    <div className="wf-left" data-testid="wf-left-panel">
      <VideoPanelNotice />
      <Tabs value={tab} onValueChange={(v) => setTab(v as PanelTab)} className="wf-left__tabs">
        <TabList>
          <Tab value="workflow">{t('workflows.panel.workflow')}</Tab>
          <Tab value="nodes">{t('workflows.panel.nodes')}</Tab>
          <Tab value="templates">{t('workflows.panel.templates')}</Tab>
          <Tab value="packs">{t('workflows.panel.packs')}</Tab>
          <Tab value="details">{t('workflows.panel.details')}</Tab>
          <Tab value="data">{t('workflows.panel.data')}</Tab>
        </TabList>
        <TabPanel value="workflow">
          <FormView />
        </TabPanel>
        <TabPanel value="nodes">
          <NodeLibrary />
        </TabPanel>
        <TabPanel value="templates">
          <TemplatesView />
        </TabPanel>
        <TabPanel value="packs">
          <PacksView />
        </TabPanel>
        <TabPanel value="details">
          <DetailsView />
        </TabPanel>
        <TabPanel value="data">
          <DataView />
        </TabPanel>
      </Tabs>
      <LibraryModal />
      <WorkflowDialogs />
    </div>
  );
}
