import { META_SCHEMA_VERSION } from "@heleonix/hx-language"
import type {
  IComponentMetaEntry,
  IDocsEntry,
  IMetaDocument,
  IQualifierDefinition,
  IRegistryMetaEntry,
} from "@heleonix/hx-language"

/**
 * Assembles a package's `hx.meta.json` manifest: one bundle per package (no
 * per-file sidecars), sections sorted deterministically so the emitted
 * artifact doesn't churn with scan order.
 */
export function buildMeta(
  input: {
    docs?: readonly IDocsEntry[]
    components?: readonly IComponentMetaEntry[]
    converters?: readonly IRegistryMetaEntry[]
    actions?: readonly IRegistryMetaEntry[]
    themeTokens?: Readonly<Record<string, string>>
    qualifiers?: readonly IQualifierDefinition[]
  },
  info?: { package?: string; version?: string },
): IMetaDocument {
  const result: IMetaDocument = { schemaVersion: META_SCHEMA_VERSION }

  if (info?.package) {
    result.package = info.package
  }

  if (info?.version) {
    result.version = info.version
  }

  if (input.docs && input.docs.length > 0) {
    result.docs = [...input.docs].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name))
  }

  if (input.components && input.components.length > 0) {
    result.components = [...input.components].sort((a, b) => a.name.localeCompare(b.name))
  }

  if (input.converters && input.converters.length > 0) {
    result.converters = [...input.converters].sort((a, b) => a.name.localeCompare(b.name))
  }

  if (input.actions && input.actions.length > 0) {
    result.actions = [...input.actions].sort((a, b) => a.name.localeCompare(b.name))
  }

  if (input.themeTokens && Object.keys(input.themeTokens).length > 0) {
    result.themeTokens = sortRecord(input.themeTokens)
  }

  if (input.qualifiers && input.qualifiers.length > 0) {
    result.qualifiers = [...input.qualifiers].sort((a, b) => a.name.localeCompare(b.name))
  }

  return result
}

/** Rebuilds a record with its keys in sorted order so the emitted manifest is stable. */
function sortRecord(record: Readonly<Record<string, string>>): Record<string, string> {
  const sorted: Record<string, string> = {}

  for (const key of Object.keys(record).sort()) {
    sorted[key] = record[key]
  }

  return sorted
}
