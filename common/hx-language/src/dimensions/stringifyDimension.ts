import type { IDimension } from "./IDimension"
import type { IDimensionDefinition } from "./IDimensionDefinition"

export function stringifyDimension(
  dimension: IDimension,
  dimensionDefinitions: readonly IDimensionDefinition[],
): string {
  return JSON.stringify(dimensionDefinitions.map((definition) => dimension[definition.name] ?? null))
}
