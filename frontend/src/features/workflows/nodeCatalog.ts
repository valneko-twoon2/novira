// What the node picker dialog and the node library tab share: which scope a node belongs to and which nodes a search matches.
import { t } from '@/i18n';
import { type FieldType } from './fieldTypes';
import { comfyCategoryLabel } from './comfyWords';
import { compatibleField } from './graph';
import { NODE_CATEGORIES, allTemplates, categoryKey, nodeDesc, nodeTitle, type NodeTemplate } from './templates';

export interface PickerFilter {
  type: FieldType;
  /** Side of the handle the connection was dragged from. */
  side: 'source' | 'target';
}

/** The scope a node belongs to: its extension's name, else its group among ComfyUI's own nodes, else its built-in category. */
export const scopeOf = (tpl: NodeTemplate) => (tpl.pack ? `pack:${tpl.pack}` : tpl.group ? `core:${tpl.group}` : `cat:${tpl.category}`);
export const groupLabel = (tpl: NodeTemplate) => tpl.pack ?? (tpl.group ? `ComfyUI / ${tpl.group}` : t(categoryKey(tpl.category)));

/** The nodes a search matches (every word, anywhere in the title in the app's language or English, description, folders, category, extension, group, type or tags), in catalog order. */
export function matchingTemplates(query: string, filter: PickerFilter | null = null): NodeTemplate[] {
  const q = query.trim().toLowerCase();
  return allTemplates()
    .filter((tpl) => !filter || compatibleField(tpl, filter) !== null)
    .filter((tpl) => {
      if (!q) return true;
      // The name in the app's language and the English one, and ComfyUI's names of the node's folders, all match.
      const folders = (tpl.comfyCategory ?? '').split('/').map((part) => comfyCategoryLabel(part.trim()));
      const hay = [nodeTitle(tpl.type), tpl.title ?? '', nodeDesc(tpl.type), t(categoryKey(tpl.category)), tpl.pack ?? '', tpl.group ?? '', tpl.type, ...folders, ...tpl.tags].join(' ').toLowerCase();
      return q.split(/\s+/).every((w) => hay.includes(w));
    })
    .sort((a, b) => NODE_CATEGORIES.indexOf(a.category) - NODE_CATEGORIES.indexOf(b.category) || (a.pack ?? '').localeCompare(b.pack ?? '') || (a.group ?? '').localeCompare(b.group ?? ''));
}
