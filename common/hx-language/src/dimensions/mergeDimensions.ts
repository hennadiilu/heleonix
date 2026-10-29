import type { IDimension } from "./IDimension"
import type { IDimensionDefinition } from "./IDimensionDefinition"
import type { DimensionUsage } from "./DimensionUsage"
import { matchDimension } from "./matchDimension"

export function mergeDimensions<T extends { dimension: IDimension; usage?: DimensionUsage }>(
  definitions: readonly T[],
  dimension: IDimension,
  dimensionDefinitions: readonly IDimensionDefinition[],
  mergeFn: (base: T | undefined, extension: T) => T,
  defaultUsage: DimensionUsage,
  base?: T,
): T | undefined {
  const matches: { definition: T; specificity: number }[] = []

  for (const definition of definitions) {
    const specificity = matchDimension(definition.dimension, dimension, dimensionDefinitions)

    if (specificity !== undefined) {
      matches.push({ definition, specificity })
    }
  }

  matches.sort((left, right) => left.specificity - right.specificity)

  let result: T | undefined = base

  for (const { definition } of matches) {
    const usage = definition.usage ?? defaultUsage

    if (!result || usage === "override") {
      result = mergeFn(undefined, definition)
    } else {
      result = mergeFn(result, definition)
    }
  }

  return result
}
