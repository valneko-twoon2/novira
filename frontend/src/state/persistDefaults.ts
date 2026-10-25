// Reading a store's saved object back over its defaults. zustand's own merge puts a saved object in place of the default
// one, so a field added to a form after it was saved would read `undefined` for everyone who used the app before.

/**
 * A `merge` for `persist` whose state keeps one object under `key` (a form, a scene): the saved fields are laid over
 * `defaults`, and a saved value that is not an object leaves the current one alone.
 */
export function overDefaults<K extends string, T extends object>(key: K, defaults: T) {
  return <S extends Record<K, T>>(saved: unknown, current: S): S => {
    const stored = saved && typeof saved === 'object' ? (saved as Partial<Record<K, unknown>>)[key] : undefined;
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return current;
    return { ...current, [key]: { ...defaults, ...(stored as Partial<T>) } };
  };
}
