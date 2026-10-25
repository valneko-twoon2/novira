// Runs a ComfyUI prompt through the queue and waits for what it makes: a picture (`runJob`) or text (`runTextJob`).
import { backend, type BackendEvent, type EnqueueRequest, type ImageDTO, type QueueItem } from '@/backend';

/**
 * Queues the request and waits until `result` finds its outcome in a backend event of the job. Rejects with the
 * engine's message when the job fails, and with an AbortError when the signal is aborted (the job is cancelled).
 */
function waitForJob<T>(request: EnqueueRequest, result: (event: BackendEvent, id: number) => { value: T } | null, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    let id: number | null = null;
    const early: BackendEvent[] = [];
    const finish = (done: () => void) => {
      off();
      signal?.removeEventListener('abort', onAbort);
      done();
    };
    const handle = (event: BackendEvent) => {
      const found = result(event, id!);
      if (found) finish(() => resolve(found.value));
      else if (event.type === 'queue_item_status_changed' && event.item.id === id) {
        if (event.item.status === 'failed') finish(() => reject(new Error(event.item.error ?? 'failed')));
        else if (event.item.status === 'canceled') finish(() => reject(new DOMException('aborted', 'AbortError')));
      }
    };
    const off = backend.subscribe((event) => (id === null ? early.push(event) : handle(event)));
    const onAbort = () => {
      if (id !== null) void backend.cancelQueueItem(id);
      else finish(() => reject(new DOMException('aborted', 'AbortError')));
    };
    signal?.addEventListener('abort', onAbort);
    backend.enqueue(request).then(
      ([item]) => {
        id = item!.id;
        if (signal?.aborted) onAbort();
        early.splice(0).forEach(handle);
      },
      (e: unknown) => finish(() => reject(e instanceof Error ? e : new Error(String(e)))),
    );
  });
}

/** The picture a queued prompt makes; see `waitForJob` for how it ends otherwise. */
export function runJob(request: EnqueueRequest, signal?: AbortSignal): Promise<ImageDTO> {
  return waitForJob(request, (event, id) => (event.type === 'image_added' && event.item?.id === id ? { value: event.image } : null), signal);
}

/** The finished queue item of a job, from a status event. */
function completed(event: BackendEvent, id: number): QueueItem | null {
  return event.type === 'queue_item_status_changed' && event.item.id === id && event.item.status === 'completed' ? event.item : null;
}

/** The text a queued prompt makes (its output node is ComfyUI's "Preview as Text"); no picture is stored. */
export function runTextJob(request: EnqueueRequest, signal?: AbortSignal): Promise<string> {
  return waitForJob(
    request,
    (event, id) => {
      const item = completed(event, id);
      return item ? { value: item.resultText ?? '' } : null;
    },
    signal,
  );
}
