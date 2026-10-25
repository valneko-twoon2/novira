// Custom React Flow node for an invocation: header, connection handles, input controls, outputs and footer.
import { CaretDown, CaretRight, Info, ListPlus, Lightning, LightningSlash } from '@phosphor-icons/react';
import { Position, type NodeProps } from '@xyflow/react';
import { memo, useState, type CSSProperties } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { t } from '@/i18n';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { useWorkflows, type WorkflowNode } from '@/state/workflows/workflows';
import {
  Checkbox,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ProgressBar,
  TextInput,
  Textarea,
  Tooltip,
  cx,
} from '@/ui';
import { useLastWorkflowImageUrl, useWorkflowExecution } from './execution';
import { AssistHandle, useNodeBlocked } from './connectAssist';
import { FieldControl } from './FieldControl';
import { typeColorVar, type FieldType } from './fieldTypes';
import { nodeWidget } from './nodeWidgets';
import { useComfyWords } from './comfyWords';
import { fieldLabel, fieldTooltip, getTemplate, isActive, nodeDesc, nodeTitle, outputLabel, type InputTemplate, type OutputTemplate } from './templates';

const handleStyle = (type: FieldType) => ({ '--wf-handle-color': typeColorVar(type) }) as CSSProperties;

export const InvocationNode = memo(function InvocationNode({ id, data, selected }: NodeProps<WorkflowNode>) {
  // Re-render when the nodes of custom node packs are (re)loaded, and when ComfyUI's words for them arrive.
  useComfyNodes((s) => s.defs);
  useComfyWords();
  const template = getTemplate(data.type);
  const connected = useWorkflows(useShallow((s) => s.edges.filter((e) => e.target === id).map((e) => e.targetHandle ?? '')));
  const exposed = useWorkflows(useShallow((s) => s.form.filter((f) => f.nodeId === id).map((f) => f.fieldName)));
  const updateNodeData = useWorkflows((s) => s.updateNodeData);
  const { executing, progress } = useWorkflowExecution();
  const blocked = useNodeBlocked(id, data.type);
  if (!template) return <div className="wf-node wf-node--invalid">{data.type}</div>;
  const Widget = nodeWidget(template.comfyClass);

  const isRunning = executing && data.type === 'denoise_latents';
  const active = template.inputs.filter((i) => isActive(i, data.inputs));
  const connectionInputs = active.filter((i) => i.input === 'connection');
  const valueInputs = active.filter((i) => i.input !== 'connection');
  const rows = Math.max(connectionInputs.length, template.outputs.length);

  return (
    <div className={cx('wf-node', selected && 'is-selected', blocked && 'is-blocked', isRunning && 'is-running', !data.isOpen && 'is-collapsed')} data-testid={`wf-node-${data.type}`}>
      <NodeHeader id={id} data={data} onToggle={() => updateNodeData(id, { isOpen: !data.isOpen })} />
      {!data.isOpen && <CollapsedHandles nodeId={id} inputs={active} outputs={template.outputs} />}
      {data.isOpen && (
        <>
          {isRunning && <ProgressBar className="wf-node__progress" value={progress ? progress.step / progress.totalSteps : 0} indeterminate={!progress} />}
          <div className="wf-node__body">
            {rows > 0 && (
              <div className="wf-node__grid">
                {Array.from({ length: rows }, (_, i) => (
                  <div className="wf-node__gridrow" key={i}>
                    <div>{connectionInputs[i] && <InputRow nodeId={id} nodeType={data.type} input={connectionInputs[i]} connected exposed={false} handleOnly />}</div>
                    <div>{template.outputs[i] && <OutputRow nodeId={id} nodeType={data.type} output={template.outputs[i]} />}</div>
                  </div>
                ))}
              </div>
            )}
            {valueInputs.map((input) => (
              <InputRow
                key={input.name}
                nodeId={id}
                nodeType={data.type}
                input={input}
                value={data.inputs[input.name]}
                connected={connected.includes(input.name)}
                exposed={exposed.includes(input.name)}
              />
            ))}
            {Widget && <Widget nodeId={id} />}
            {template.unsupported && <div className="wf-node__notice">{t('workflows.node.unsupportedInputs', { names: template.unsupported.join(', ') })}</div>}
            {(data.type === 'l2i' || data.type === 'current_image') && <NodePreview running={executing} progressUrl={progress?.progressImageUrl ?? null} />}
          </div>
          <div className="wf-node__footer nodrag">
            <Checkbox checked={data.useCache} onChange={(v) => updateNodeData(id, { useCache: v })} label={t('workflows.node.useCache')} />
            {template.isOutput && <span className="wf-node__badge">{t('workflows.node.output')}</span>}
          </div>
        </>
      )}
    </div>
  );
});

function NodeHeader({ id, data, onToggle }: { id: string; data: WorkflowNode['data']; onToggle: () => void }) {
  const updateNodeData = useWorkflows((s) => s.updateNodeData);
  const [editing, setEditing] = useState(false);
  const title = data.label || nodeTitle(data.type);
  return (
    <div className="wf-node__header">
      <IconButton
        className="nodrag"
        label={data.isOpen ? t('workflows.node.collapse') : t('workflows.node.expand')}
        icon={data.isOpen ? <CaretDown size={12} /> : <CaretRight size={12} />}
        size="xs"
        tooltip={false}
        onClick={onToggle}
      />
      {editing ? (
        <TextInput
          className="wf-node__title-input nodrag"
          autoFocus
          defaultValue={title}
          aria-label={t('workflows.node.rename')}
          onBlur={(e) => {
            const v = e.target.value.trim();
            updateNodeData(id, { label: v === nodeTitle(data.type) ? '' : v });
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') setEditing(false);
            e.stopPropagation();
          }}
        />
      ) : (
        <span className="wf-node__title" title={t('workflows.node.renameHint')} onDoubleClick={() => setEditing(true)}>
          {title}
        </span>
      )}
      <Tooltip content={data.useCache ? t('workflows.node.cacheOn') : t('workflows.node.cacheOff')}>
        <span className={cx('wf-node__cache', data.useCache && 'is-on')}>{data.useCache ? <Lightning size={12} weight="fill" /> : <LightningSlash size={12} />}</span>
      </Tooltip>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className={cx('wf-node__info nodrag', data.notes && 'has-notes')} aria-label={t('workflows.node.notes')}>
            <Info size={14} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="wf-notes" side="top">
          <div className="wf-notes__title">{nodeTitle(data.type)}</div>
          <div className="wf-notes__desc">{nodeDesc(data.type)}</div>
          <div className="wf-notes__meta">
            {data.type} · v{getTemplate(data.type)?.version}
          </div>
          <Textarea
            rows={4}
            value={data.notes}
            placeholder={t('workflows.node.notesPlaceholder')}
            aria-label={t('workflows.node.notes')}
            onChange={(e) => updateNodeData(id, { notes: e.target.value })}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function CollapsedHandles({ nodeId, inputs, outputs }: { nodeId: string; inputs: InputTemplate[]; outputs: OutputTemplate[] }) {
  return (
    <>
      {inputs
        .filter((i) => i.input !== 'direct')
        .map((i) => (
          <AssistHandle nodeId={nodeId} key={`in-${i.name}`} type="target" id={i.name} position={Position.Left} className="wf-handle wf-handle--collapsed" style={handleStyle(i.type)} />
        ))}
      {outputs.map((o) => (
        <AssistHandle nodeId={nodeId} key={`out-${o.name}`} type="source" id={o.name} position={Position.Right} className="wf-handle wf-handle--collapsed" style={handleStyle(o.type)} />
      ))}
    </>
  );
}

function FieldLabel({ nodeId, nodeType, input, exposed }: { nodeId: string; nodeType: string; input: InputTemplate; exposed: boolean }) {
  const showTypes = useWorkflows((s) => s.settings.showFieldTypes);
  const addFormField = useWorkflows((s) => s.addFormField);
  const removeFormField = useWorkflows((s) => s.removeFormField);
  const label = fieldLabel(nodeType, input.name);
  const tooltip = fieldTooltip(nodeType, input);
  const toggle = () => (exposed ? removeFormField({ nodeId, fieldName: input.name }) : addFormField({ nodeId, fieldName: input.name }));
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <span className="wf-field__label">
          <Tooltip
            content={
              showTypes || tooltip ? (
                <span className="wf-field__tip">
                  {tooltip}
                  {showTypes && <FieldTypeTip type={input.type} required={input.required} />}
                </span>
              ) : null
            }
          >
            <span className={cx('wf-field__name', input.required && 'is-required')}>{label}</span>
          </Tooltip>
          {input.input !== 'connection' && (
            <IconButton
              className={cx('wf-field__expose nodrag', exposed && 'is-exposed')}
              label={exposed ? t('workflows.node.removeFromForm') : t('workflows.node.addToForm')}
              icon={<ListPlus size={12} />}
              size="xs"
              onClick={toggle}
            />
          )}
        </span>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem icon={<ListPlus size={14} />} onSelect={toggle} disabled={input.input === 'connection'}>
          {exposed ? t('workflows.node.removeFromForm') : t('workflows.node.addToForm')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function FieldTypeTip({ type, required }: { type: FieldType; required?: boolean }) {
  return (
    <span className="wf-typetip">
      <span className="wf-typetip__swatch" style={handleStyle(type)} />
      {type}
      {required && <span className="wf-typetip__req">{t('workflows.node.required')}</span>}
    </span>
  );
}

function InputRow({
  nodeId,
  nodeType,
  input,
  value,
  connected,
  exposed,
  handleOnly,
}: {
  nodeId: string;
  nodeType: string;
  input: InputTemplate;
  value?: unknown;
  connected: boolean;
  exposed: boolean;
  handleOnly?: boolean;
}) {
  const hasHandle = input.input !== 'direct';
  return (
    <div className={cx('wf-field', handleOnly && 'wf-field--handle', connected && 'is-connected')}>
      {hasHandle && <AssistHandle nodeId={nodeId} type="target" id={input.name} position={Position.Left} className="wf-handle" style={handleStyle(input.type)} />}
      <FieldLabel nodeId={nodeId} nodeType={nodeType} input={input} exposed={exposed} />
      {!handleOnly && !connected && <FieldControl nodeId={nodeId} input={input} value={value} label={fieldLabel(nodeType, input.name)} />}
    </div>
  );
}

function OutputRow({ nodeId, nodeType, output }: { nodeId: string; nodeType: string; output: OutputTemplate }) {
  const showTypes = useWorkflows((s) => s.settings.showFieldTypes);
  return (
    <div className="wf-field wf-field--output">
      <Tooltip content={showTypes ? <FieldTypeTip type={output.type} /> : null}>
        <span className="wf-field__name">{outputLabel(nodeType, output.name)}</span>
      </Tooltip>
      <AssistHandle nodeId={nodeId} type="source" id={output.name} position={Position.Right} className="wf-handle" style={handleStyle(output.type)} />
    </div>
  );
}

function NodePreview({ running, progressUrl }: { running: boolean; progressUrl: string | null }) {
  const last = useLastWorkflowImageUrl();
  const url = running && progressUrl ? progressUrl : last;
  return <div className="wf-node__preview">{url ? <img src={url} alt="" draggable={false} /> : <span>{t('workflows.node.noPreview')}</span>}</div>;
}
