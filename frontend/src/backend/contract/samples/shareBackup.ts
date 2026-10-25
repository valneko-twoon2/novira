// Export for sharing and backups: the options and replies of `export_images`, the watermark's status and check,
// `create_backup`, `open_backup` and `take_restored_ui_state`.
import type {
  BackupInfo,
  BackupPhase,
  BackupSummary,
  ExportFormat,
  ExportOptions,
  ExportResult,
  RestoreOutcome,
  WatermarkCheck,
  WatermarkStatus,
} from '../../types';
import { allOf, type ByState } from './helpers';

export const exportOptions = { format: 'jpeg', quality: 85, maxSide: 1536, removeInfo: true, watermark: true } satisfies Required<ExportOptions>;

export const exportResult = { count: 3, skipped: 1, watermarked: 2, folder: 'D:/Pictures/shared' } satisfies Required<ExportResult>;

export const backupInfo = {
  appVersion: '0.1.0',
  createdAt: 1_760_000_000_000,
  images: 120,
  boards: 4,
  workflows: 2,
} satisfies Required<BackupInfo>;

export const backupSummary = { fileName: 'novira-backup-20261006-1230.zip', bytes: 52_428_800, info: backupInfo } satisfies Required<BackupSummary>;

export const restoreOutcome = {
  none: { state: 'none' },
  restored: { state: 'restored', uiState: '{"novira.settings":"{}"}' },
  failed: { state: 'failed', message: 'the backup could not be restored; your data was kept as it was' },
} satisfies ByState<RestoreOutcome>;

export const shareEnums = {
  ExportFormat: allOf<ExportFormat>()(['png', 'jpeg', 'webp']),
  BackupPhase: allOf<BackupPhase>()(['create', 'restore']),
};

export const watermarkStatus = {
  missing: { state: 'missing' },
  downloading: { state: 'downloading', done: 1_048_576, total: 137_080_000 },
  ready: { state: 'ready' },
  failed: { state: 'failed', message: 'download answered 404 Not Found' },
} satisfies ByState<WatermarkStatus>;

export const watermarkCheck = {
  fileName: 'shared.jpg',
  watermarkChecked: true,
  watermarkFound: true,
  noviraMarker: true,
  watermarkId: '0308ad2be03e',
  originalName: '74d534a5c47f4a508dd8f4100f0e4158.png',
  originalInGallery: true,
  exportedAt: 1_791_653_354_461,
  credentialsPresent: true,
  credentialsValid: true,
  credentialsTrusted: false,
  credentialsAi: true,
  credentialsSigner: 'novira',
  credentialsThisApp: true,
  iptcAi: true,
} satisfies Required<WatermarkCheck>;
