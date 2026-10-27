// Import dialog: the install sources as tabs.
import { t } from '@/i18n';
import { useModelImport, type ImportTab } from '@/state/dialogs/modelImport';
import { Modal, Tab, TabList, TabPanel, Tabs } from '@/ui';
import { InstallFromSource } from './InstallFromSource';
import { InstallHuggingFace } from './InstallHuggingFace';
import { InstallScanFolder } from './InstallScanFolder';
import { InstallStarter } from './InstallStarter';

export function ImportDialog() {
  const open = useModelImport((s) => s.isOpen);
  const tab = useModelImport((s) => s.tab);
  return (
    <Modal open={open} onOpenChange={(next) => (next ? useModelImport.getState().open() : useModelImport.getState().close())} title={t('models.import.title')} size={tab === 'starter' ? 'xl' : 'lg'} closeLabel={t('common.close')}>
      <Tabs className="mm-install__tabs" value={tab} onValueChange={(v) => useModelImport.getState().setTab(v as ImportTab)}>
        <TabList>
          <Tab value="source">{t('models.install.tab.source')}</Tab>
          <Tab value="huggingface">{t('models.install.tab.huggingface')}</Tab>
          <Tab value="scan">{t('models.install.tab.scan')}</Tab>
          <Tab value="starter">{t('models.install.tab.starter')}</Tab>
        </TabList>
        <TabPanel value="source" className="mm-install__panel">
          <InstallFromSource />
        </TabPanel>
        <TabPanel value="huggingface" className="mm-install__panel">
          <InstallHuggingFace />
        </TabPanel>
        <TabPanel value="scan" className="mm-install__panel">
          <InstallScanFolder />
        </TabPanel>
        <TabPanel value="starter" className="mm-install__panel">
          <InstallStarter />
        </TabPanel>
      </Tabs>
    </Modal>
  );
}
