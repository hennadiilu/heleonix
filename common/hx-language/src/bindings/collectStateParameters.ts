import { extractParameters } from "../interpolation/extractParameters"
import { parseBindingExpression } from "./parseBindingExpression"
import { parseConverterCall } from "./parseConverterCall"

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
