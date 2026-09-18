import type { IDimension } from "./IDimension"
import type { IDimensionDefinition } from "./IDimensionDefinition"

export function selectByDimensions<T extends { dimension: IDimension }>(
  definitions: readonly T[],
  dimension: IDimension,
  dimensionDefinitions: readonly IDimensionDefinition[],
): T | undefined {
  let best: T | undefined
  let bestSpecificity = -1

  for (const definition of definitions) {
    let specificity = 0
    let matches = true

    for (const { name } of dimensionDefinitions) {
      // A definition constrained on a dimension only applies when the current dimension
      // has that exact value; with the value unset, only unconstrained definitions apply.
      if (name in definition.dimension) {
        if (definition.dimension[name] !== dimension[name]) {
          matches = false
          break
        }

        specificity++
      }
    }

    if (!matches) {
      continue
    }

    if (specificity > bestSpecificity) {
      best = definition
      bestSpecificity = specificity
    }
  }

  return best
}
