// Custom edge colored by the field type it carries; animated while a workflow runs.
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { memo } from 'react';
import { useWorkflows } from '@/state/workflows/workflows';
import { cx } from '@/ui';
import { useWorkflowExecution } from './execution';
import { isCompatible, typeColorVar, type FieldType } from './fieldTypes';
import { connectionTypes } from './graph';
import { useComfyWords } from './comfyWords';
import { fieldLabel, outputLabel } from './templates';

export const FieldEdge = memo(function FieldEdge(props: EdgeProps) {
  const { id, source, target, sourceHandleId, targetHandleId, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected } = props;
  const types = useWorkflows((s) => {
    const r = connectionTypes(s.nodes, { source, target, sourceHandle: sourceHandleId, targetHandle: targetHandleId });
    return r ? `${r.from}|${r.to}` : null;
  });
  const showLabels = useWorkflows((s) => s.settings.showEdgeLabels);
  useComfyWords();
  const sourceType = useWorkflows((s) => (showLabels ? s.nodes.find((n) => n.id === source)?.data.type : undefined)) ?? '';
  const targetType = useWorkflows((s) => (showLabels ? s.nodes.find((n) => n.id === target)?.data.type : undefined)) ?? '';
  const animatedSetting = useWorkflows((s) => s.settings.animatedEdges);
  const { executing } = useWorkflowExecution();
  const [from, to] = (types?.split('|') ?? []) as (FieldType | undefined)[];
  const valid = !!from && !!to && isCompatible(from, to);
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, curvature: 0.3 });
  const color = valid && from ? typeColorVar(from) : 'var(--danger)';
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        className={cx('wf-edge', selected && 'is-selected', (executing || animatedSetting) && 'is-animated', !valid && 'is-invalid')}
        style={{ stroke: color }}
      />
      {showLabels && sourceHandleId && targetHandleId && (
        <EdgeLabelRenderer>
          <div className="wf-edge__label" style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}>
            {outputLabel(sourceType, sourceHandleId)} → {fieldLabel(targetType, targetHandleId)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});
