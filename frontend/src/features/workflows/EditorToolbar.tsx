// Floating buttons over the editor: new, save, optimize, more menu, update nodes and settings.
import {
  ArrowsClockwise,
  DotsThreeVertical,
  DownloadSimple,
  FilePlus,
  FloppyDisk,
  GearSix,
  MagicWand,
  UploadSimple,
} from '@phosphor-icons/react';
import { Panel, useReactFlow } from '@xyflow/react';
import { useRef } from 'react';
import { t } from '@/i18n';
import { toast } from '@/state/toasts';
import { useWorkflows, type EditorSettings } from '@/state/workflows/workflows';
import { IconButton, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Popover, PopoverContent, PopoverTrigger, Switch, chordLabel } from '@/ui';
import { canSaveInPlace, downloadWorkflow, loadWorkflowFile, newWorkflow, saveWorkflow } from './actions';
import { confirmDiscard, useDialogs } from './dialogs';
import { optimizeWorkflow } from './optimizeWorkflow';

export function requestSave() {
  if (canSaveInPlace()) void saveWorkflow();
  else useDialogs.getState().setSaveAsOpen(true);
}

export function EditorToolbar() {
  const fileRef = useRef<HTMLInputElement>(null);
  const name = useWorkflows((s) => s.meta.name);
  const touched = useWorkflows((s) => s.isTouched);
  const setSaveAsOpen = useDialogs((s) => s.setSaveAsOpen);
  const flow = useReactFlow();
  const optimize = () => {
    if (optimizeWorkflow()) requestAnimationFrame(() => void flow.fitView({ padding: 0.15, duration: 200 }));
  };
  return (
    <>
      <Panel position="top-left" className="wf-toolbar">
        <IconButton label={t('workflows.toolbar.new')} icon={<FilePlus size={16} />} variant="solid" onClick={() => confirmDiscard(newWorkflow)} />
        <IconButton label={t('workflows.toolbar.save')} tooltip={`${t('workflows.toolbar.save')} (${chordLabel('mod+s')})`} icon={<FloppyDisk size={16} />} variant="solid" onClick={requestSave} />
        <IconButton label={t('workflows.toolbar.optimize')} tooltip={t('workflows.toolbar.optimizeHint')} icon={<MagicWand size={16} />} variant="solid" onClick={optimize} data-testid="wf-optimize" />
        <Menu>
          <MenuTrigger asChild>
            <IconButton label={t('workflows.toolbar.more')} icon={<DotsThreeVertical size={16} />} variant="solid" />
          </MenuTrigger>
          <MenuContent>
            <MenuItem icon={<FloppyDisk size={14} />} onSelect={requestSave} shortcut={chordLabel('mod+s')}>
              {t('common.save')}
            </MenuItem>
            <MenuItem icon={<FloppyDisk size={14} />} onSelect={() => setSaveAsOpen(true)}>
              {t('common.saveAs')}
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={<DownloadSimple size={14} />} onSelect={downloadWorkflow}>
              {t('workflows.toolbar.download')}
            </MenuItem>
            <MenuItem icon={<UploadSimple size={14} />} onSelect={() => fileRef.current?.click()}>
              {t('workflows.toolbar.loadFromFile')}
            </MenuItem>
          </MenuContent>
        </Menu>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) confirmDiscard(() => void loadWorkflowFile(f));
          }}
        />
      </Panel>
      <Panel position="top-center" className="wf-titlebar">
        <span className="wf-titlebar__name" data-testid="wf-name">
          {name || t('workflows.untitled')}
        </span>
        {touched && <span className="wf-dot" aria-label={t('workflows.unsaved')} title={t('workflows.unsaved')} />}
      </Panel>
      <Panel position="top-right" className="wf-toolbar">
        <IconButton
          label={t('workflows.toolbar.updateNodes')}
          icon={<ArrowsClockwise size={16} />}
          variant="solid"
          onClick={() => toast({ status: 'info', title: t('workflows.toasts.nodesUpToDate') })}
        />
        <SettingsPopover />
      </Panel>
    </>
  );
}

const SETTING_KEYS: { key: keyof EditorSettings; label: () => string }[] = [
  { key: 'snapToGrid', label: () => t('workflows.settings.snapToGrid') },
  { key: 'showEdgeLabels', label: () => t('workflows.settings.showEdgeLabels') },
  { key: 'animatedEdges', label: () => t('workflows.settings.animatedEdges') },
  { key: 'showMinimap', label: () => t('workflows.settings.showMinimap') },
  { key: 'showFieldTypes', label: () => t('workflows.settings.showFieldTypes') },
  { key: 'autoTidy', label: () => t('workflows.settings.autoTidy') },
];

function SettingsPopover() {
  const settings = useWorkflows((s) => s.settings);
  const setSettings = useWorkflows((s) => s.setSettings);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton label={t('workflows.settings.title')} icon={<GearSix size={16} />} variant="solid" />
      </PopoverTrigger>
      <PopoverContent align="end" className="wf-settings">
        <div className="wf-settings__title">{t('workflows.settings.title')}</div>
        {SETTING_KEYS.map(({ key, label }) => (
          <label key={key} className="wf-settings__row">
            <span>{label()}</span>
            <Switch checked={settings[key]} onChange={(v) => setSettings({ [key]: v })} aria-label={label()} />
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}
