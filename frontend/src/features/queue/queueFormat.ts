// Label keys and time formatting for queue items. Keys only; render with t() at render time.
import type { QueueDestination, QueueItem, QueueItemStatus, QueueOrigin } from '@/backend';
import { getLocale, type MessageKey } from '@/i18n';

export const STATUS_KEYS: Record<QueueItemStatus, MessageKey> = {
  pending: 'queue.status.pending',
  in_progress: 'queue.status.inProgress',
  completed: 'queue.status.completed',
  failed: 'queue.status.failed',
  canceled: 'queue.status.canceled',
};

export const ORIGIN_KEYS: Record<QueueOrigin, MessageKey> = {
  generate: 'queue.origin.generate',
  canvas: 'queue.origin.canvas',
  upscaling: 'queue.origin.upscaling',
  workflows: 'queue.origin.workflows',
};

export const DESTINATION_KEYS: Record<QueueDestination, MessageKey> = {
  gallery: 'queue.destination.gallery',
  canvas: 'queue.destination.canvas',
  intermediate: 'queue.destination.intermediate',
};

export function formatTime(ms: number | null): string {
  if (ms === null) return '';
  return new Date(ms).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Seconds between start and completion, or null when not finished/started. */
export function durationSeconds(item: QueueItem): number | null {
  if (item.startedAt === null || item.completedAt === null) return null;
  return Math.max(0, (item.completedAt - item.startedAt) / 1000);
}

export function shortId(id: string): string {
  const parts = id.split('-');
  return parts.length > 1 ? (parts[1] ?? id) + '-' + (parts[2] ?? '').slice(-4) : id.slice(0, 8);
}
