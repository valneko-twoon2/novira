// Public i18n API: t(), tCount(), locale switching.
import { en, ja, loadCatalog, LOCALES, type Catalog, type Locale, type MessageKey } from './catalog';
import { renderTemplate, type MessageArgs } from './render';

export type { Locale, MessageKey } from './catalog';
export { LOCALES } from './catalog';

let current: Locale = 'ja';
/** The language asked for last; a load that finishes after another language was chosen does not switch. */
let wanted: Locale = 'ja';
/** The catalogs at hand: ja and en are built in, the others arrive with their chunk. */
const loaded: Partial<Record<Locale, Catalog>> = { ja, en };
const loading = new Map<Locale, Promise<Catalog>>();
let ready: Promise<void> = Promise.resolve();
const listeners = new Set<(l: Locale) => void>();

export function getLocale(): Locale {
  return current;
}

function load(locale: Locale): Promise<Catalog> {
  const have = loaded[locale];
  if (have) return Promise.resolve(have);
  let pending = loading.get(locale);
  if (!pending) {
    pending = loadCatalog(locale).then(
      (catalog) => (loaded[locale] = catalog),
      (err: unknown) => {
        loading.delete(locale);
        throw err;
      },
    );
    loading.set(locale, pending);
  }
  return pending;
}

function apply(locale: Locale): void {
  if (locale === current) return;
  current = locale;
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
  listeners.forEach((fn) => fn(locale));
}

/**
 * Switches the language. ja and en (and a language loaded before) switch at once; another one switches when its catalog
 * has loaded, and the promise settles then (it rejects when the catalog cannot be loaded, and the language stays).
 */
export function setLocale(locale: Locale): Promise<void> {
  // A saved setting may name a language this build no longer ships.
  if (!(LOCALES as readonly string[]).includes(locale)) locale = 'ja';
  wanted = locale;
  if (loaded[locale]) {
    apply(locale);
    ready = Promise.resolve();
    return ready;
  }
  const target = locale;
  const switched = load(target).then(() => {
    if (wanted === target) apply(target);
  });
  // Waiting for the language never fails: start-up renders in the language at hand when the load fails.
  ready = switched.catch(() => undefined);
  return switched;
}

/** Settles when the language asked for last is shown (or could not be loaded): start-up waits for it before the first render. */
export function localeReady(): Promise<void> {
  return ready;
}

/** Loads catalogs without switching to them (tests that go through every language). */
export async function loadLocales(locales: readonly Locale[] = LOCALES): Promise<void> {
  await Promise.all(locales.map(load));
}

/** The catalog of a language once it is loaded (tests change it to check the fallback). */
export function loadedCatalog(locale: Locale): Catalog | undefined {
  return loaded[locale];
}

export function onLocaleChange(fn: (l: Locale) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function lookup(key: MessageKey): string {
  // A language that has not been translated yet shows the English text, then the Japanese source.
  return loaded[current]?.[key] ?? en[key] ?? ja[key] ?? '';
}

/** Render a message for the current locale. */
export function t(key: MessageKey, args?: MessageArgs): string {
  return renderTemplate(lookup(key), args);
}

type CountBase = {
  [K in MessageKey]: K extends `${infer B}.other` ? B : never;
}[MessageKey];

/** Render a count-dependent message using `<key>.one` / `<key>.other`. `{count}` is provided. */
export function tCount(base: CountBase, count: number, args?: MessageArgs): string {
  const key = (count === 1 && `${base}.one` in ja ? `${base}.one` : `${base}.other`) as MessageKey;
  return renderTemplate(lookup(key), { count, ...args });
}
