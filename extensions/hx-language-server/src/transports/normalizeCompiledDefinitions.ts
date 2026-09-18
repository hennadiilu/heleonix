import type { IMetaDocument } from "@heleonix/hx-language"
import type { ICompiledDefinitions } from "./ICompiledDefinitions"

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
