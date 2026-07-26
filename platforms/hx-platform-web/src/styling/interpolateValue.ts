import { parseBindingExpression } from "@heleonix/hx-language"
import { mangleVariable } from "./mangleVariable"

const INTERPOLATION = /\{([^}]+)\}([a-z%]*)/gi

/**
 * Turns a compiled declaration value's `{...}` interpolations into CSS: theme
 * (`{$Colors.bg}`) and state (`{prop}`) sources become `var(--hx-...)` chains,
 * and because CSS cannot concatenate a `var()` with a unit, a source glued to a
 * unit (`{prop}px`) becomes `calc(var(--hx-prop) * 1px)`. Surrounding literal
 * CSS text is untouched; sources with no web `var()` mapping are left as-is.
 */
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
