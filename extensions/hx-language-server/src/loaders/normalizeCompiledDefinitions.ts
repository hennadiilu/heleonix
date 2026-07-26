import type { IMetaDocument } from "@heleonix/hx-language"
import type { ICompiledDefinitions } from "./ICompiledDefinitions"

/**
 * Coerces arbitrary parsed JSON (from a file, endpoint or package) into a
 * well-formed {@link ICompiledDefinitions}: each kind becomes an array of object
 * entries, dropping anything of the wrong shape. Field-level validity is left to
 * {@link projectCompiledDefinitions}, which skips malformed definitions - this
 * only guarantees the container is iterable.
 *
 * A bare `hx.meta.json` (a single manifest, identified by its numeric
 * `schemaVersion`) is accepted directly: it is itself a meta document, so it is
 * carried whole into `metas` for the analyzer and its `docs` section is surfaced
 * to the index. Its other sections are {@link IMetaDocument} facts, not compiled
 * `I*Definition` entries, so they are not collected as definitions. This mirrors
 * `PackageDefinitionLoader`, so an `http(s)` endpoint may serve either the
 * envelope or a raw manifest.
 */
export function normalizeCompiledDefinitions(value: unknown): Required<ICompiledDefinitions> {
  const result: Required<ICompiledDefinitions> = {
    components: [],
    dictionaries: [],
    configs: [],
    docs: [],
    metas: [],
  }

  if (!value || typeof value !== "object") {
    return result
  }

  const source = value as Partial<Record<keyof ICompiledDefinitions, unknown>> & { schemaVersion?: unknown }

  if (typeof source.schemaVersion === "number") {
    result.metas.push(source as IMetaDocument)
    collect(source.docs, result.docs)

    return result
  }

  collect(source.components, result.components)
  collect(source.dictionaries, result.dictionaries)
  collect(source.configs, result.configs)
  collect(source.docs, result.docs)
  collect(source.metas, result.metas)

  return result
}

function collect<T>(value: unknown, target: T[]): void {
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (entry && typeof entry === "object") {
        target.push(entry as T)
      }
    }
  }
}

/** Concatenates one manifest's entries into an accumulator (for directory/multi-file sources). */
export function mergeCompiledDefinitions(
  target: Required<ICompiledDefinitions>,
  source: Required<ICompiledDefinitions>,
): void {
  target.components.push(...source.components)
  target.dictionaries.push(...source.dictionaries)
  target.configs.push(...source.configs)
  target.docs.push(...source.docs)
  target.metas.push(...source.metas)
}
