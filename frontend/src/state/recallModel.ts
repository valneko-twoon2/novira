// Which installed main model a recalled picture was made with. Pictures made elsewhere and imported (an A1111 or
// Forge picture names its checkpoint "WAI-illustrious-SDXL-v17") carry no key of this app, only a name that is
// written a little differently from the installed file ("waiIllustriousSDXL_v170"), so the name is matched loosely.
import type { ModelConfig } from '@/backend';
import { t } from '@/i18n';
import { isDrawable } from './models';

export type RecalledModel =
  /** The stored key is installed. */
  | { kind: 'key'; key: string }
  /** The stored key is not installed, and one installed model the Generate tab draws with goes by the stored name. */
  | { kind: 'name'; model: ModelConfig }
  /** Nothing installed goes by the stored name (or more than one does): the current model stays. */
  | { kind: 'missing'; name: string }
  /** The picture names no model at all: the current model stays. */
  | { kind: 'none' };

/** A model name with case, spaces and punctuation taken out: "WAI-illustrious-SDXL-v17" → "waiillustrioussdxlv17". */
export function normalizeModelName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** The names a model goes by: its own and its file's, without the extension. */
function namesOf(m: ModelConfig): string[] {
  const file = (m.path.split(/[\\/]/).pop() ?? '').replace(/\.[a-z0-9]+$/i, '');
  return [m.name, file].map(normalizeModelName).filter(Boolean);
}

/**
 * The one main model that goes by `name`: an exact match (after normalizing), else the only model whose name starts
 * with it ("…v17" finds "…v170"). Null when none matches or the start is shared by several.
 */
export function matchModelByName(name: string, models: ModelConfig[]): ModelConfig | null {
  const wanted = normalizeModelName(name);
  if (!wanted) return null;
  const mains = models.filter(isDrawable);
  const exact = mains.filter((m) => namesOf(m).includes(wanted));
  if (exact.length) return exact.length === 1 ? exact[0]! : null;
  const prefixed = mains.filter((m) => namesOf(m).some((n) => n.startsWith(wanted)));
  return prefixed.length === 1 ? prefixed[0]! : null;
}

export function recalledModel(stored: { modelKey: string; modelName: string }, models: ModelConfig[]): RecalledModel {
  if (stored.modelKey && models.some((m) => m.key === stored.modelKey && isDrawable(m))) return { kind: 'key', key: stored.modelKey };
  const name = stored.modelName.trim();
  if (!name) return stored.modelKey ? { kind: 'missing', name: stored.modelKey } : { kind: 'none' };
  const model = matchModelByName(name, models);
  return model ? { kind: 'name', model } : { kind: 'missing', name };
}

/** The key a recall sets: the found model's, else the current one (a model that is not installed is never set). */
export function recalledModelKey(found: RecalledModel, current: string | null): string | null {
  return found.kind === 'key' ? found.key : found.kind === 'name' ? found.model.key : current;
}

/** What the recall notification adds about the model: which one was found by name, or that none was. */
export function recalledModelNote(found: RecalledModel | undefined): { status: 'info' | 'warning'; description: string } | null {
  if (found?.kind === 'missing') return { status: 'warning', description: t('gallery.toast.recallModelMissing', { name: found.name }) };
  if (found?.kind === 'name') return { status: 'info', description: t('gallery.toast.recallModelByName', { name: found.model.name }) };
  return null;
}
