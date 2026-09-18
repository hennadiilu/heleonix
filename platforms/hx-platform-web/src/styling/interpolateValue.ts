import { parseBindingExpression } from "@heleonix/hx-language"
import { mangleVariable } from "./mangleVariable"

const INTERPOLATION = /\{([^}]+)\}([a-z%]*)/gi

export function interpolateValue(value: string): string {
  return value.replace(INTERPOLATION, (whole: string, inner: string, unit: string): string => {
    const binding = parseBindingExpression(inner)

    if (binding.type !== "theme" && binding.type !== "state") {
      return whole
    }

    const reference = `var(${mangleVariable(binding.value)})`

    return unit ? `calc(${reference} * 1${unit})` : reference
  })
}
