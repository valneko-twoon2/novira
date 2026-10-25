// What the AI assistant is told about the ready-made graphs and the node catalog when it builds a workflow.
import type { AgentNodeType, AgentRecipe, ComfyNodeDefs } from '@/backend';
import { t, type MessageKey } from '@/i18n';
import type { AgentExtensionNode } from '@/state/agentExtensions';
import { comfyPack } from './comfyNodes';
import { GRAPH_TEMPLATES } from './graphTemplates';
import { allTemplates } from './templates';

/** Extension nodes beyond this many are left out of the node list (the ones the recipes use stay), to keep the prompt small. */
const MAX_EXTENSION_NODES = 80;

/** The graph recipes with the packs each still lacks, so the assistant recommends a pack instead of using nodes that do not exist. */
export function agentRecipes(installedPacks: string[]): AgentRecipe[] {
  return GRAPH_TEMPLATES.map((g) => ({
    id: g.id,
    title: t(`workflows.templates.${g.id}.title` as MessageKey),
    about: t(`workflows.templates.${g.id}.desc` as MessageKey),
    missing: (g.packs ?? []).filter((p) => !installedPacks.includes(p)),
    nodes: g.nodes,
    edges: g.edges,
  }));
}

/**
 * Built-in node types and, from installed packs, as many extension nodes as fit. The nodes a recipe uses are always
 * there; the hundreds of other nodes of ComfyUI itself are left out, since the list would crowd out the rest.
 */
export function agentNodeTypes(): AgentNodeType[] {
  const used = new Set(GRAPH_TEMPLATES.flatMap((g) => g.nodes.map((n) => n[1])));
  const all = allTemplates();
  const extension = all.filter((n) => n.pack);
  const keepAll = extension.length <= MAX_EXTENSION_NODES;
  return all
    .filter((n) => used.has(n.type) || (n.pack ? keepAll : !n.type.startsWith('comfy:')))
    .map((n) => ({ type: n.type, inputs: n.inputs.map((i) => `${i.name}:${i.type}`), outputs: n.outputs.map((o) => `${o.name}:${o.type}`) }));
}

/** The nodes an installed extension adds to ComfyUI (by its folder name), as the assistant is told about them. */
export function extensionNodes(defs: ComfyNodeDefs | null, folder: string): AgentExtensionNode[] {
  const typeName = (type: string | string[]) => (typeof type === 'string' ? type : 'choice');
  return Object.values(defs ?? {})
    .filter((d) => comfyPack(d)?.toLowerCase() === folder.toLowerCase())
    .map((d) => ({
      name: d.display_name || d.name,
      ...(d.description ? { about: d.description.slice(0, 240) } : {}),
      inputs: [...Object.entries(d.input.required ?? {}), ...Object.entries(d.input.optional ?? {})].slice(0, 12).map(([name, spec]) => `${name}:${typeName(spec[0])}`),
      outputs: d.output.map((type, i) => {
        const label = d.output_name?.[i];
        return label && label !== typeName(type) ? `${label}:${typeName(type)}` : typeName(type);
      }),
    }));
}
