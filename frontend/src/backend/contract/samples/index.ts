// The TypeScript samples of the contract fixtures in `contract/` (repository root). Test-only: imported by
// `../../contract.test.ts`, never by the app.
import { agentEndpointInput, agentEndpointTest, agentReply, agentRequest, agentStatus, agentToolAnswer } from './agent';
import { enums } from './enums';
import { FAMILY_SAMPLING } from '../../familySampling';
import { backendEvents, bootstrap, engineSettings, engineSettingsPatch, engineStatus, hardwareInfo, packStatus } from './events';
import { boardDto, boardPatch, imageDto, imageOptions, imagePatch } from './gallery';
import {
  civitaiSearchParams,
  civitaiSearchResult,
  modelConfig,
  modelInstallJob,
  modelPartsReport,
  scannedFile,
  starterModel,
} from './models';
import { enqueueRequest, generationMetadata, lowMemoryMode, progressEvent, queueItem, queueSnapshot, retrySize } from './queue';
import { comicRecord } from './comics';
import { backupInfo, backupSummary, exportOptions, exportResult, restoreOutcome, shareEnums, watermarkCheck, watermarkStatus } from './shareBackup';
import { comfyUiLocale, faceRigPreviewRequest, nodePacks, savedWorkflow, workflowInput } from './workflows';
import { unfinishedDownload } from './unfinished';

/** Fixture file name (without `.json`) to its TypeScript sample. */
export const SAMPLES: Record<string, unknown> = {
  enums,
  // Not a wire type: the app's own table of the samplers the backend fixes per family, checked against Rust's.
  'family-sampling': FAMILY_SAMPLING,
  'generation-metadata': generationMetadata,
  'enqueue-request': enqueueRequest,
  'queue-item': queueItem,
  'queue-snapshot': queueSnapshot,
  'progress-event': progressEvent,
  'retry-size': retrySize,
  'low-memory-mode': lowMemoryMode,
  'engine-settings': engineSettings,
  'engine-settings-patch': engineSettingsPatch,
  'image-dto': imageDto,
  'board-dto': boardDto,
  'board-patch': boardPatch,
  'image-patch': imagePatch,
  'image-options': imageOptions,
  'model-config': modelConfig,
  'starter-model': starterModel,
  'model-parts-report': modelPartsReport,
  'model-install-job': modelInstallJob,
  'scanned-file': scannedFile,
  'civitai-search-params': civitaiSearchParams,
  'civitai-search-result': civitaiSearchResult,
  'saved-workflow': savedWorkflow,
  'workflow-input': workflowInput,
  'comic-record': comicRecord,
  'node-packs': nodePacks,
  'comfy-ui-locale': comfyUiLocale,
  'face-rig-preview-request': faceRigPreviewRequest,
  'engine-status': engineStatus,
  'pack-status': packStatus,
  'hardware-info': hardwareInfo,
  bootstrap,
  'backend-events': backendEvents,
  'agent-request': agentRequest,
  'agent-status': agentStatus,
  'agent-reply': agentReply,
  'agent-endpoint-test': agentEndpointTest,
  'agent-endpoint-input': agentEndpointInput,
  'agent-tool-answer': agentToolAnswer,
  'export-options': exportOptions,
  'export-result': exportResult,
  'backup-info': backupInfo,
  'backup-summary': backupSummary,
  'restore-outcome': restoreOutcome,
  'share-enums': shareEnums,
  'watermark-status': watermarkStatus,
  'watermark-check': watermarkCheck,
  'unfinished-download': unfinishedDownload,
};
