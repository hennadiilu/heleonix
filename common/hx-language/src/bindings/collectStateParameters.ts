import { extractParameters } from "../interpolation/extractParameters"
import { parseBindingExpression } from "./parseBindingExpression"
import { parseConverterCall } from "./parseConverterCall"

/**
 * Collects the distinct state paths a dictionary template depends on for
 * reactivity: the source of every `{...}` interpolation whose source is a state
 * path, plus every state-typed converter argument in its pipe chain. Dictionary
 * and config sources react to culture/dimension switches instead, so they are
 * not returned here.
 */
export function collectStateParameters(template: string): string[] {
  const result = new Set<string>()

  for (const inner of extractParameters(template)) {
    const expression = parseBindingExpression(inner)

    if (expression.type === "state") {
      result.add(expression.value)
    }

    for (const segment of expression.converters ?? []) {
      for (const arg of Object.values(parseConverterCall(segment).args)) {
        if (arg.type === "state") {
          result.add(arg.value)
        }
      }
    }
  }

  return [...result]
}
