// The starter files (text encoders, VAE, vision model) the models loaded in parts need, and installing the missing ones.
// The backend decides what a model needs and which starter entry installs it (`backend.modelParts`); this keeps its answer
// for the selected model, offers the install after a model arrives, and runs the installs with the starter install path.
import { create } from 'zustand';
import { backend, type ModelConfig, type ModelPartsReport, type StarterModel } from '@/backend';
import { t } from '@/i18n';
import { describeError, devLog } from './devLog';
import { installModel, sourceState } from './modelInstall';
import { useModels } from './models';

/** A download above this many bytes is confirmed before it starts (decimal GB, as the sizes are listed). */
export const CONFIRM_BYTES = 5_000_000_000;

interface ModelPartsState {
  /** The last answer per model key. */
  reports: Record<string, ModelPartsReport>;
  /** The report the confirmation dialog shows; null while it is closed. */
  offer: ModelPartsReport | null;
  setReport: (report: ModelPartsReport) => void;
  openOffer: (report: ModelPartsReport) => void;
  closeOffer: () => void;
}

export const useModelParts = create<ModelPartsState>()((set) => ({
  reports: {},
  offer: null,
  setReport: (report) => set((s) => ({ reports: { ...s.reports, [report.modelKey]: report } })),
  openOffer: (offer) => set({ offer }),
  closeOffer: () => set({ offer: null }),
}));

/** Asks the backend what a model is missing and keeps the answer. Null when the call failed (logged). */
export async function refreshModelParts(modelKey: string): Promise<ModelPartsReport | null> {
  try {
    const report = await backend.modelParts(modelKey);
    useModelParts.getState().setReport(report);
    return report;
  } catch (err) {
    devLog('warn', 'frontend', `Could not check the parts of a model: ${describeError(err)}`);
    return null;
  }
}

/** The missing parts that are neither installed nor being installed. */
export function partsToInstall(report: ModelPartsReport, models: ModelConfig[] = useModels.getState().models): StarterModel[] {
  const jobs = useModels.getState().installJobs;
  return report.missing.filter((p) => !sourceState(p.source, models, jobs));
}

/** The summed download size of parts, in bytes (a part without a known size counts as 0). */
export function partsBytes(parts: StarterModel[]): number {
  return parts.reduce((sum, p) => sum + (p.sizeBytes ?? 0), 0);
}

/** A size for the buttons and the dialog (decimal units, like the starter list's descriptions). */
export function formatPartsSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1e6))} MB`;
}

/** Starts the installs of these parts through the starter install path. */
export async function installParts(parts: StarterModel[]): Promise<void> {
  await Promise.all(parts.map((p) => installModel(p.source, p.name)));
}

/**
 * The Generate panel's button: installs what is missing at once, or opens the confirmation when the download is large.
 * Nothing happens when there is nothing left to start.
 */
export async function installMissingParts(report: ModelPartsReport): Promise<void> {
  const parts = partsToInstall(report);
  if (parts.length === 0) return;
  if (partsBytes(parts) > CONFIRM_BYTES) useModelParts.getState().openOffer(report);
  else await installParts(parts);
}

/** Why a model cannot draw yet because parts are missing (null when nothing is known to be missing). */
export function modelPartsReason(modelKey: string | null | undefined): string | null {
  const report = modelKey ? useModelParts.getState().reports[modelKey] : undefined;
  if (!report || report.missing.length === 0) return null;
  return t('params.readiness.modelNeedsParts', { model: report.modelName, parts: report.missing.map((p) => p.name).join(', ') });
}

/**
 * Right after a model is added: if it needs parts the library lacks (and none is on its way), offers to install them.
 * A file that is not a model of a split family has nothing missing, so nothing is offered.
 */
export async function offerPartsFor(model: ModelConfig): Promise<void> {
  if (model.type !== 'diffusion_model' && model.type !== 'main') return;
  const report = await refreshModelParts(model.key);
  if (report && partsToInstall(report).length > 0) useModelParts.getState().openOffer(report);
}
