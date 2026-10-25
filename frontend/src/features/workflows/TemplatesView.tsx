// "Templates" tab of the Workflows left panel: ready-made graphs with an animated mini map. A card opens the graph as a
// new workflow, or adds it next to what is already on the canvas. A graph that needs custom node packs offers to
// install them (and to restart ComfyUI) until its nodes are there.
import { ArrowClockwise, DownloadSimple, Plus, Play, PuzzlePiece } from '@phosphor-icons/react';
import { useEffect, type CSSProperties } from 'react';
import { t } from '@/i18n';
import type { MessageKey } from '@/i18n';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { packKey, useNodePacks } from '@/state/comfy/nodePacks';
import { toast } from '@/state/toasts';
import { useWorkflows } from '@/state/workflows/workflows';
import { Button } from '@/ui';
import { loadWorkflowGraph } from './actions';
import { PACK_CATALOG, packFolder } from '@/state/comfy/packCatalog';
import { typeColorVar } from './fieldTypes';
import { buildTemplate, GRAPH_TEMPLATES, templateGraph, type GraphTemplate } from './graphTemplates';
import { serializeWorkflow } from './serialize';
import { getTemplate } from './templates';

const NODE_W = 300;
const NODE_H = 150;

const titleKey = (id: string) => `workflows.templates.${id}.title` as MessageKey;
const descKey = (id: string) => `workflows.templates.${id}.desc` as MessageKey;

/** Where an added template goes: to the right of the nodes already on the canvas, at their top edge. */
export function addOffset(nodes: { position: { x: number; y: number } }[]): { x: number; y: number } {
  if (!nodes.length) return { x: 0, y: 0 };
  return { x: Math.max(...nodes.map((n) => n.position.x)) + 460, y: Math.min(...nodes.map((n) => n.position.y)) };
}

function outputColor(type: string): string {
  const out = getTemplate(type)?.outputs[0];
  return out ? typeColorVar(out.type) : 'var(--base-500)';
}

/** The graph drawn small: a box per node (coloured by what it outputs) and a curve per connection. */
export function TemplatePreview({ template }: { template: GraphTemplate }) {
  const xs = template.nodes.map((n) => n[2]);
  const ys = template.nodes.map((n) => n[3]);
  const x0 = Math.min(...xs) - 20;
  const y0 = Math.min(...ys) - 20;
  const w = Math.max(...xs) - x0 + NODE_W + 20;
  const h = Math.max(...ys) - y0 + NODE_H + 20;
  const at = new Map(template.nodes.map((n) => [n[0], n]));
  return (
    <svg className="wf-tpl__preview" viewBox={`${x0} ${y0} ${w} ${h}`} aria-hidden>
      {template.edges.map(([from, , to], i) => {
        const a = at.get(from);
        const b = at.get(to);
        if (!a || !b) return null;
        const sx = a[2] + NODE_W;
        const sy = a[3] + NODE_H / 2;
        const ex = b[2];
        const ey = b[3] + NODE_H / 2;
        const mid = Math.max(40, (ex - sx) / 2);
        return <path key={i} className="wf-tpl__edge" d={`M${sx} ${sy} C${sx + mid} ${sy} ${ex - mid} ${ey} ${ex} ${ey}`} />;
      })}
      {template.nodes.map(([key, type, x, y], i) => (
        <rect key={key} className="wf-tpl__node" x={x} y={y} width={NODE_W} height={NODE_H} rx={18} style={{ '--wf-tpl-color': outputColor(type), '--wf-tpl-delay': `${i * 40}ms` } as CSSProperties} />
      ))}
    </svg>
  );
}

/** Whether every node of the template is known (its packs are installed and loaded). */
export function templateReady(template: GraphTemplate): boolean {
  return template.nodes.every(([, type]) => !!getTemplate(type));
}

/** What a template that needs packs still waits for: none, an install, or a ComfyUI restart. */
function PackNeeds({ template }: { template: GraphTemplate }) {
  const packs = (template.packs ?? []).map((id) => PACK_CATALOG.find((p) => p.id === id)).filter((p) => !!p);
  const installed = useNodePacks((s) => s.packs?.installed);
  const jobs = useNodePacks((s) => s.jobs);
  const install = useNodePacks((s) => s.install);
  const restart = useNodePacks((s) => s.restart);
  const restarting = useNodePacks((s) => s.restarting);
  const isIn = (url: string) => !!installed?.some((i) => i.url === packKey(url) || i.folder === packFolder(url));
  const missing = packs.filter((p) => !isIn(p.url));
  const busy = packs.some((p) => ['downloading', 'installing'].includes(jobs[packKey(p.url)]?.state ?? ''));
  const failed = packs.map((p) => jobs[packKey(p.url)]).find((j) => j?.state === 'error');
  return (
    <div className="wf-tpl__packs">
      <span className="wf-tpl__needs">
        <PuzzlePiece size={12} /> {t('workflows.templates.needsPacks', { packs: packs.map((p) => packFolder(p.url)).join(', ') })}
      </span>
      {missing.length > 0 ? (
        <Button size="xs" variant="solid" leftIcon={<DownloadSimple size={12} />} isLoading={busy} onClick={() => missing.forEach((p) => void install(p.url))} data-testid="wf-template-install">
          {t('workflows.templates.installPacks')}
        </Button>
      ) : (
        <Button size="xs" variant="solid" leftIcon={<ArrowClockwise size={12} />} isLoading={restarting} onClick={() => void restart()}>
          {t('workflows.templates.restartFirst')}
        </Button>
      )}
      {failed?.state === 'error' && <p className="wf-packs__error">{failed.message}</p>}
    </div>
  );
}

function TemplateCard({ template }: { template: GraphTemplate }) {
  // Re-render when pack nodes are (re)loaded.
  useComfyNodes((s) => s.defs);
  const ready = templateReady(template);
  const name = t(titleKey(template.id));
  const open = () => loadWorkflowGraph(serializeWorkflow(templateGraph(template, name)), name);
  const add = () => {
    const s = useWorkflows.getState();
    const built = buildTemplate(template, addOffset(s.nodes));
    s.addNodes(built.nodes, built.edges);
    toast({ status: 'success', title: t('workflows.templates.added', { name }) });
  };
  return (
    <article className="wf-tpl" data-testid="wf-template">
      <TemplatePreview template={template} />
      <div className="wf-tpl__body">
        <h3>{name}</h3>
        <p>{t(descKey(template.id))}</p>
        {!ready && (template.packs?.length ? <PackNeeds template={template} /> : <p className="wf-tpl__needs">{t('workflows.templates.needsEngine')}</p>)}
        <div className="wf-tpl__actions">
          <Button size="xs" variant="solid" leftIcon={<Play size={12} weight="fill" />} onClick={open} disabled={!ready} data-testid="wf-template-open">
            {t('workflows.templates.open')}
          </Button>
          <Button size="xs" leftIcon={<Plus size={12} />} onClick={add} disabled={!ready} data-testid="wf-template-add">
            {t('workflows.templates.add')}
          </Button>
          <span className="wf-tpl__count">{t('workflows.templates.nodes', { count: template.nodes.length })}</span>
        </div>
      </div>
    </article>
  );
}

export function TemplatesView() {
  const load = useNodePacks((s) => s.load);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div className="wf-templates" data-testid="wf-templates">
      <p className="wf-templates__hint">{t('workflows.templates.hint')}</p>
      {GRAPH_TEMPLATES.map((tpl) => (
        <TemplateCard key={tpl.id} template={tpl} />
      ))}
    </div>
  );
}
