// Start-up marks and backend call timings for the measurement tool (tools/perf.mjs); nothing on screen shows them. Always
// on and cheap: a mark is one `performance.mark`, a call is one entry in a ring of the last CALL_LIMIT. The size of an
// answer is measured only while the session flag RECORD_FLAG is '1' (the harness sets it and reloads), since that turns
// the answer into JSON text. The harness reads it all with `window.__noviraPerf.snapshot()`.

/** How many calls the ring keeps; older ones are dropped, so a long session never grows. */
export const CALL_LIMIT = 500;
/** Session storage key that switches on the size of each answer. */
export const RECORD_FLAG = 'novira-perf-record';

/** The moments of a start, in order (`performance.mark` names are `novira:<mark>`). */
export type StartMark = 'backend-ready' | 'app-loaded' | 'bootstrap-received' | 'stores-filled' | 'shell-visible' | 'first-thumbnail';

export interface CallTiming {
  /** The command (Tauri and HTTP), or the mock's method in snake case. */
  name: string;
  /** ms since the page's time origin. */
  start: number;
  duration: number;
  ok: boolean;
  /** Length of the answer as JSON text, only while recording. */
  size?: number;
}

export interface PerfSnapshot {
  marks: Partial<Record<StartMark, number>>;
  calls: CallTiming[];
  /** Calls dropped from the ring. */
  dropped: number;
  recording: boolean;
}

export interface PerfRecorder {
  /** Notes a start moment; only its first time counts. */
  mark(name: StartMark): void;
  /** Runs one backend call and notes its time. */
  timed<T>(name: string, run: () => Promise<T>): Promise<T>;
  /** Wraps every method of a class prototype: a method whose result is a promise is noted as a call. */
  timeMethods(proto: object, nameOf: (method: string) => string): void;
  snapshot(): PerfSnapshot;
}

interface Options {
  now?: () => number;
  limit?: number;
  recording?: boolean;
  /** Where a mark also goes (the browser's performance timeline). */
  markEntry?: (name: string) => void;
}

export function createRecorder({ now = () => performance.now(), limit = CALL_LIMIT, recording = false, markEntry }: Options = {}): PerfRecorder {
  const marks: PerfSnapshot['marks'] = {};
  const ring: CallTiming[] = [];
  let next = 0;
  let total = 0;
  const push = (name: string, start: number, ok: boolean, value?: unknown) => {
    const entry: CallTiming = { name, start, duration: now() - start, ok };
    if (recording && ok) entry.size = jsonSize(value);
    ring[next] = entry;
    next = (next + 1) % limit;
    total++;
  };
  const settle = <T>(name: string, start: number, promise: Promise<T>): Promise<T> =>
    promise.then(
      (value) => {
        push(name, start, true, value);
        return value;
      },
      (err: unknown) => {
        push(name, start, false);
        throw err;
      },
    );
  return {
    mark(name) {
      if (marks[name] !== undefined) return;
      marks[name] = now();
      markEntry?.(`novira:${name}`);
    },
    timed(name, run) {
      return settle(name, now(), run());
    },
    timeMethods(proto, nameOf) {
      const target = proto as Record<string, unknown>;
      for (const key of Object.getOwnPropertyNames(proto)) {
        const method = Object.getOwnPropertyDescriptor(proto, key)?.value;
        if (key === 'constructor' || typeof method !== 'function') continue;
        const name = nameOf(key);
        target[key] = function (this: unknown, ...args: unknown[]) {
          const start = now();
          const result: unknown = method.apply(this, args);
          return result instanceof Promise ? settle(name, start, result) : result;
        };
      }
    },
    snapshot() {
      const calls = total > limit ? [...ring.slice(next), ...ring.slice(0, next)] : ring.slice(0, total);
      return { marks: { ...marks }, calls: calls.map((c) => ({ ...c })), dropped: Math.max(0, total - limit), recording };
    },
  };
}

function jsonSize(value: unknown): number {
  try {
    return JSON.stringify(value)?.length ?? 0;
  } catch {
    return -1;
  }
}

/** `listImages` → `list_images`, so the mock's names read like the commands. */
export function snakeCase(name: string): string {
  return name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function recordingOn(): boolean {
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(RECORD_FLAG) === '1';
  } catch {
    return false;
  }
}

/** The page's recorder. */
export const perf: PerfRecorder = createRecorder({
  recording: recordingOn(),
  markEntry: (name) => {
    if (typeof performance.mark === 'function') performance.mark(name);
  },
});

if (typeof window !== 'undefined') {
  Object.defineProperty(window, '__noviraPerf', { value: Object.freeze({ snapshot: () => perf.snapshot() }), configurable: true });
}
