// The partial file of an interrupted download that Settings, Data lists (`listUnfinishedDownloads`).
import type { UnfinishedDownload } from '../../types';

export const unfinishedDownload = {
  path: 'comfyui/.downloads/comfyui.part',
  name: 'comfyui.part',
  bytes: 1_048_576,
} satisfies Required<UnfinishedDownload>;
