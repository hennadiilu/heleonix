import { promises as fsp } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { META_CONDITION, EXT_KIND, IDocsEntry, IMetaDocument, Kind } from "@heleonix/hx-language"
import { DefinitionLoader } from "./DefinitionLoader"
import { ICompiledDefinitions } from "./ICompiledDefinitions"

// Export conditions that carry compiled definitions, derived from the DSL's own
// extension table (`.hxm` -> "component", ...) rather than hardcoded: the
// condition is the extension without its dot (`hxm`, `hxd`, ...).
const KIND_BY_CONDITION: ReadonlyMap<string, Kind> = new Map(
  Object.entries(EXT_KIND).map(([ext, kind]) => [ext.replace(/^\./, ""), kind]),
)

/**
 * Loads compiled definitions shipped by an installed package via its
 * `package.json` `exports`. Any subpath whose target is a conditions object
 * carrying one of the DSL's kind conditions (`hxm`/`hxd`/`hxc`/`hxs`/`hxt`,
 * from {@link KIND_BY_CONDITION}) is a definition export; the kind is the
 * condition and the target is glob-expanded (the key's `*` maps to the target's
 * `*`) to enumerate the per-resource `.json` files. The package's runtime
 * (`default`) and any non-definition exports are ignored, so no package code is
 * executed. Package resolution uses Node's own algorithm from the workspace
 * root, so hoisting and pnpm's symlinked layout are handled for free.
 *
 * Only the kinds the index currently consumes (component/dictionary/config) are
 * collected; `style`/`theme` are recognized but skipped until the server indexes
 * them. Docs ship inside the `hxmeta` condition manifest (`hx.meta.json`; per-file
 * sidecars or a package bundle - same shape) or bare `IDocsEntry[]` arrays. The
 * assembled {@link ICompiledDefinitions} is projected downstream by
 * {@link CompiledDefinitionSource}.
 */
export class PackageDefinitionLoader implements DefinitionLoader {
  public readonly id: string

  public constructor(
    private readonly specifier: string,
    private readonly fromDir: string,
  ) {
    this.id = `package:${specifier}`
  }

  public async load(): Promise<ICompiledDefinitions> {
    // `require` bound to a file in the workspace root; the file need not exist -
    // it only seeds the resolution base.
    const require = createRequire(path.join(this.fromDir, "__hx_resolve__.js"))
    const manifestPath = require.resolve(`${this.specifier}/package.json`)
    const packageDir = path.dirname(manifestPath)
    const exports = (JSON.parse(await fsp.readFile(manifestPath, "utf8")) as PackageJson).exports

    // Only the kinds the index consumes get a bucket; style/theme resolve to
    // `undefined` here and are skipped.
    const buckets = new Map<Kind, object[]>([
      ["component", []],
      ["dictionary", []],
      ["config", []],
    ])
    const docs: IDocsEntry[] = []
    const metas: IMetaDocument[] = []

    if (exports && typeof exports === "object" && !Array.isArray(exports)) {
      for (const target of Object.values(exports)) {
        if (!target || typeof target !== "object" || Array.isArray(target)) {
          continue
        }

        for (const [condition, kind] of KIND_BY_CONDITION) {
          const pattern = (target as Record<string, unknown>)[condition]
          const bucket = buckets.get(kind)

          if (typeof pattern === "string" && bucket) {
            await collect(packageDir, pattern, bucket)
          }
        }

        const metaPattern = (target as Record<string, unknown>)[META_CONDITION]

        if (typeof metaPattern === "string") {
          await collectMeta(packageDir, metaPattern, docs, metas)
        }
      }
    }

    return {
      components: buckets.get("component"),
      dictionaries: buckets.get("dictionary"),
      configs: buckets.get("config"),
      docs,
      metas,
    } as ICompiledDefinitions
  }
}

/** Glob-expands one export target and appends each parsed `.json` definition to `bucket`. */
async function collect(packageDir: string, target: string, bucket: object[]): Promise<void> {
  // In `exports`, the single `*` captures across `/`, so a target like
  // `./dist/hxm/*.json` legitimately matches nested files too. A plain glob `*`
  // stops at a path segment, so widen it to `**/*` to enumerate nested layouts
  // as well as flat ones (`**/` also matches zero segments). `./` is dropped so
  // matching is anchored at the package root.
  const pattern = target.replace(/^\.\//, "").replace("*", "**/*")

  for await (const match of fsp.glob(pattern, { cwd: packageDir })) {
    if (path.extname(match).toLowerCase() !== ".json") {
      continue
    }

    const value = await readJson(path.resolve(packageDir, match))

    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry && typeof entry === "object") {
          bucket.push(entry as object)
        }
      }
    } else if (value && typeof value === "object") {
      bucket.push(value)
    }
  }
}

/**
 * Reads the `hxmeta` condition's manifests: each matched file is a full
 * `IMetaDocument` (collected into `metas` for the analyzer, and its `docs`
 * section collected for the index), a legacy docs envelope with `entries`, or a
 * bare `IDocsEntry[]`. The full manifest is what carries type-level facts
 * (props/events/controls, converters, actions, theme tokens, qualifiers).
 */
async function collectMeta(
  packageDir: string,
  target: string,
  docs: IDocsEntry[],
  metas: IMetaDocument[],
): Promise<void> {
  const pattern = target.replace(/^\.\//, "").replace("*", "**/*")

  for await (const match of fsp.glob(pattern, { cwd: packageDir })) {
    if (path.extname(match).toLowerCase() !== ".json") {
      continue
    }

    const value = await readJson(path.resolve(packageDir, match))

    if (Array.isArray(value)) {
      pushEntries(value, docs)

      continue
    }

    const manifest = value as (Partial<IMetaDocument> & { entries?: unknown }) | undefined

    if (manifest && typeof manifest.schemaVersion === "number") {
      metas.push(manifest as IMetaDocument)
    }

    const entries = manifest?.docs ?? manifest?.entries

    if (Array.isArray(entries)) {
      pushEntries(entries, docs)
    }
  }
}

function pushEntries(entries: readonly unknown[], bucket: IDocsEntry[]): void {
  for (const entry of entries) {
    if (entry && typeof entry === "object") {
      bucket.push(entry as IDocsEntry)
    }
  }
}

async function readJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await fsp.readFile(file, "utf8"))
  } catch {
    // A single malformed/unreadable file must not sink the whole package.
    return undefined
  }
}

interface PackageJson {
  exports?: unknown
}
