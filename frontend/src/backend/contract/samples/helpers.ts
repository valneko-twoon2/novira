// Type helpers shared by the contract samples (see `../../contract.test.ts`).
import type { BackendClient } from '../../client';
import type { Bootstrap } from '../../tauri/TauriBackend';
import type { ImageDTO } from '../../types';

/** Every member of the string union `T`, each once; a missing member is a type error naming it. */
export const allOf =
  <T extends string>() =>
  <const A extends readonly T[]>(values: A & ([Exclude<T, A[number]>] extends [never] ? unknown : { missing: Exclude<T, A[number]> })) =>
    values;

/** One sample per variant of a union tagged by `type` (or `state`), keyed by the tag: a missing variant is a type error. */
export type ByType<U extends { type: string }> = { [K in U['type']]: Required<Extract<U, { type: K }>> };
export type ByState<U extends { state: string }> = { [K in U['state']]: Required<Extract<U, { state: K }>> };

// Wire types the client interface names only inline.
export type WorkflowInput = Parameters<BackendClient['saveWorkflow']>[0];
export type BoardPatch = Parameters<BackendClient['updateBoard']>[1];
export type ImagePatch = Parameters<BackendClient['updateImages']>[1];
export type ImageOptions = Parameters<BackendClient['uploadImage']>[1];
export type ScannedFile = NonNullable<Awaited<ReturnType<BackendClient['scanFolder']>>>[number];
export type QueueSnapshot = Bootstrap['queue'];
export type MediaType = NonNullable<ImageDTO['mediaType']>;
