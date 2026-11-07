// A runtime check of a JSON value against a type declared in `types.ts`, for the differential contract test
// (`../contractCorpus.test.ts`). The app has no runtime validator (the wire types are structural TypeScript types, and
// nothing in the app refuses a bad answer), so this reads the declarations with the TypeScript compiler API and asks
// what the type system itself would require of a JSON value:
// - an object needs every property that is not optional, and each property must fit its type;
// - a union takes the first member that fits, a literal type takes only that literal;
// - `string`, `number` and `boolean` take any value of that JavaScript type (TypeScript has no integer or range types);
// - an unknown key is accepted (structural typing) but not part of the result, which is the value the type describes.
// It cannot refuse what TypeScript cannot express: a non-integer or out-of-range number, or a string where Rust keeps a
// `String` and TypeScript a union of literals is the other way round (TypeScript is the stricter one there).
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/** A refusal names the JSON pointer of the value that does not fit and what it was (`missing` for an absent key). */
export type Checked = { ok: true; out: unknown } | { ok: false; path: string; got: string; why: string };

const HERE = dirname(fileURLToPath(import.meta.url));
// `types.ts` plus the helper that names the wire types `client.ts` writes inline (a patch, the upload options).
const FILES = [join(HERE, '..', 'types.ts'), join(HERE, 'samples', 'helpers.ts')];
const MAX_DEPTH = 24;

export function wireValidator() {
  const program = ts.createProgram(FILES, {
    strict: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true,
    noEmit: true,
    types: [],
  });
  const checker = program.getTypeChecker();
  const exported = new Map<string, ts.Symbol>();
  for (const file of FILES) {
    const source = program.getSourceFile(file);
    const moduleSymbol = source && checker.getSymbolAtLocation(source);
    if (!moduleSymbol) throw new Error(`cannot read ${file}`);
    for (const s of checker.getExportsOfModule(moduleSymbol)) if (!exported.has(s.name)) exported.set(s.name, s);
  }

  const fail = (path: string, got: string, why: string): Checked => ({ ok: false, path, got, why });
  const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
  const kind = (v: unknown) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

  function check(type: ts.Type, value: unknown, at: string, depth: number): Checked {
    if (depth > MAX_DEPTH) return fail(at, kind(value), 'too deep');
    const f = type.flags;
    if (f & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return { ok: true, out: value };
    if (type.isUnion()) {
      let deepest: Checked | undefined;
      for (const member of type.types) {
        if (member.flags & ts.TypeFlags.Undefined) continue;
        const r = check(member, value, at, depth + 1);
        if (r.ok) return r;
        if (!deepest || (!deepest.ok && r.path.length > deepest.path.length)) deepest = r;
      }
      return deepest ?? fail(at, kind(value), 'empty union');
    }
    if (f & ts.TypeFlags.Null) return value === null ? { ok: true, out: null } : fail(at, kind(value), 'not null');
    if (f & ts.TypeFlags.StringLiteral) return value === (type as ts.StringLiteralType).value ? { ok: true, out: value } : fail(at, kind(value), `not the literal "${(type as ts.StringLiteralType).value}"`);
    if (f & ts.TypeFlags.NumberLiteral) return value === (type as ts.NumberLiteralType).value ? { ok: true, out: value } : fail(at, kind(value), `not the number ${(type as ts.NumberLiteralType).value}`);
    if (f & ts.TypeFlags.BooleanLiteral) return value === ((type as unknown as { intrinsicName: string }).intrinsicName === 'true') ? { ok: true, out: value } : fail(at, kind(value), 'not that boolean');
    if (f & ts.TypeFlags.String) return typeof value === 'string' ? { ok: true, out: value } : fail(at, kind(value), 'not a string');
    if (f & ts.TypeFlags.Number) return typeof value === 'number' && Number.isFinite(value) ? { ok: true, out: value } : fail(at, kind(value), 'not a number');
    if (f & ts.TypeFlags.Boolean) return typeof value === 'boolean' ? { ok: true, out: value } : fail(at, kind(value), 'not a boolean');
    if (checker.isTupleType(type)) {
      const items = checker.getTypeArguments(type as ts.TypeReference);
      if (!Array.isArray(value) || value.length !== items.length) return fail(at, kind(value), `not a tuple of ${items.length}`);
      const out: unknown[] = [];
      for (let i = 0; i < items.length; i++) {
        const r = check(items[i]!, value[i], `${at}/${i}`, depth + 1);
        if (!r.ok) return r;
        out.push(r.out);
      }
      return { ok: true, out };
    }
    if (checker.isArrayType(type)) {
      if (!Array.isArray(value)) return fail(at, kind(value), 'not an array');
      const item = checker.getTypeArguments(type as ts.TypeReference)[0];
      const out: unknown[] = [];
      for (let i = 0; i < value.length; i++) {
        const r = check(item!, value[i], `${at}/${i}`, depth + 1);
        if (!r.ok) return r;
        out.push(r.out);
      }
      return { ok: true, out };
    }
    if (f & (ts.TypeFlags.Object | ts.TypeFlags.Intersection)) {
      if (!isObject(value)) return fail(at, kind(value), 'not an object');
      const out: Record<string, unknown> = {};
      const known = new Set<string>();
      for (const prop of checker.getPropertiesOfType(type)) {
        known.add(prop.name);
        const optional = (prop.flags & ts.SymbolFlags.Optional) !== 0;
        const propType = checker.getTypeOfSymbol(prop);
        if (!(prop.name in value)) {
          if (optional) continue;
          return fail(`${at}/${prop.name}`, 'missing', 'required property is absent');
        }
        const r = check(propType, value[prop.name], `${at}/${prop.name}`, depth + 1);
        if (!r.ok) return r;
        out[prop.name] = r.out;
      }
      const index = checker.getIndexInfosOfType(type).find((i) => i.keyType.flags & ts.TypeFlags.String);
      for (const [k, v] of Object.entries(value)) {
        if (known.has(k)) continue;
        if (!index) continue;
        const r = check(index.type, v, `${at}/${k}`, depth + 1);
        if (!r.ok) return r;
        out[k] = r.out;
      }
      return { ok: true, out };
    }
    return fail(at, kind(value), `type flags ${f} are not handled`);
  }

  return {
    /** Whether `types.ts` or the helper exports the name. */
    has: (name: string) => exported.has(name),
    /** Reads `value` as the exported type `name`. */
    check(name: string, value: unknown): Checked {
      const symbol = exported.get(name);
      if (!symbol) throw new Error(`no wire type ${name}`);
      return check(checker.getDeclaredTypeOfSymbol(symbol), value, '', 0);
    },
  };
}
