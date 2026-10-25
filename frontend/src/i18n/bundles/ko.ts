// The ko catalog as one chunk, loaded when the language is chosen (catalog.ts).
import type { Catalog } from '../catalog';

const AREAS = import.meta.glob<Catalog>('../locales/ko/*.json', { eager: true, import: 'default' });

export default Object.assign({}, ...Object.values(AREAS)) as Catalog;
