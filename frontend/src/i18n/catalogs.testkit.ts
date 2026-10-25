// Every language's catalog read straight from the area files, for tests that check all of them at once. The app loads
// the languages other than ja and en only when they are chosen (catalog.ts), so it has no such table.
import { LOCALES, type Catalog, type Locale } from './catalog';

const FILES = import.meta.glob<Catalog>('./locales/*/*.json', { eager: true, import: 'default' });

function merged(locale: Locale): Catalog {
  const folder = `./locales/${locale}/`;
  return Object.assign({}, ...Object.entries(FILES).filter(([path]) => path.startsWith(folder)).map(([, catalog]) => catalog)) as Catalog;
}

export const catalogs = Object.fromEntries(LOCALES.map((l) => [l, merged(l)])) as Record<Locale, Catalog>;
