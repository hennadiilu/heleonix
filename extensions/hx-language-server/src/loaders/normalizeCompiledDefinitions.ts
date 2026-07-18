import { ICompiledDefinitions } from "./ICompiledDefinitions"

/**
 * Coerces arbitrary parsed JSON (from a file, endpoint or package) into a
 * well-formed {@link ICompiledDefinitions}: each kind becomes an array of object
 * entries, dropping anything of the wrong shape. Field-level validity is left to
 * {@link projectCompiledDefinitions}, which skips malformed definitions - this
 * only guarantees the container is iterable.
 */
export function normalizeCompiledDefinitions(value: unknown): Required<ICompiledDefinitions> {
  const result: Required<ICompiledDefinitions> = { components: [], dictionaries: [], configs: [], docs: [] }

  if (!value || typeof value !== "object") {
    return result
  }

  const source = value as Partial<Record<keyof ICompiledDefinitions, unknown>>

  collect(source.components, result.components)
  collect(source.dictionaries, result.dictionaries)
  collect(source.configs, result.configs)
  collect(source.docs, result.docs)

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
}
