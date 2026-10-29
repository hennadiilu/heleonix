import type { IDimension } from "./IDimension"
import type { IDimensionDefinition } from "./IDimensionDefinition"

export function matchDimension(
  constraint: IDimension,
  dimension: IDimension,
  dimensionDefinitions: readonly IDimensionDefinition[],
): number | undefined {
  let specificity = 0

  for (const { name } of dimensionDefinitions) {
    // A definition constrained on a dimension only applies when the current dimension
    // has that exact value; with the value unset, only unconstrained definitions apply.
    if (name in constraint) {
      if (constraint[name] !== dimension[name]) {
        return undefined
      }

      specificity++
    }
  }

  return specificity
}
