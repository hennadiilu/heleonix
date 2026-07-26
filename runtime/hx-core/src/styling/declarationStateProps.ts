import { extractParameters, parseBindingExpression } from "@heleonix/hx-language"

/**
 * The distinct `{prop}` state paths one declaration group reads, so the engine
 * can keep exactly that group's CSS variables in sync on the element its class
 * lands on - the styling component's own root, or a `@hx-style(for: ...)` scope
 * target. Qualifier-argument `{prop}` subjects are a qualifier's `attach`
 * concern, not variables, so they are not scanned here.
 */
export function declarationStateProps(declarations: Readonly<Record<string, string>>): string[] {
  const props = new Set<string>()

  for (const value of Object.values(declarations)) {
    for (const inner of extractParameters(value)) {
      const binding = parseBindingExpression(inner)

      if (binding.type === "state" && binding.value) {
        props.add(binding.value)
      }
    }
  }

  return [...props]
}
