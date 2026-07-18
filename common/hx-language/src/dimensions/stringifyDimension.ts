import type { IDimension } from "./IDimension"
import type { IDimensionDefinition } from "./IDimensionDefinition"

export function stringifyDimension(
  dimension: IDimension,
  dimensionDefinitions: readonly IDimensionDefinition[],
): string {
  let result = ""

  for (const definition of dimensionDefinitions) {
    if (dimension[definition.name]) {
      result += `${dimension[definition.name]}.`
    }
  }

  return result.slice(0, -1)
}
