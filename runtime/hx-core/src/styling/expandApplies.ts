import { resolveThemeNode } from "@heleonix/hx-language"
import type { IStyleDefinition, IThemeGroup } from "@heleonix/hx-language"

/**
 * Expands a style's `@hx-apply` token groups into concrete declarations against
 * the merged theme, producing an `applies`-free definition the engine composes
 * directly. Per signature, each applied group contributes its direct leaf tokens
 * as declarations (leaf name = CSS property) in list order, then the style's own
 * explicit declarations overlay on top - so what the author wrote wins over what
 * it applies, and a later apply wins over an earlier one. Groups that resolve to
 * a leaf or a nested-only node contribute nothing (the analyzer reports those).
 * Pure and neutral - the theme snapshot is passed in, no DOM or CSS.
 */
export function expandApplies(definition: IStyleDefinition, groups: IThemeGroup): IStyleDefinition {
  if (!definition.applies) {
    return definition
  }

  const rules: IStyleDefinition["rules"] = {}
  const signatures = new Set([...Object.keys(definition.rules), ...Object.keys(definition.applies)])

  for (const signature of signatures) {
    const declarations: Record<string, string> = {}

    for (const path of definition.applies[signature] ?? []) {
      const node = resolveThemeNode(groups, path)

      if (node && typeof node === "object") {
        for (const [name, value] of Object.entries(node)) {
          if (typeof value === "string") {
            declarations[name] = value
          }
        }
      }
    }

    Object.assign(declarations, definition.rules[signature])
    rules[signature] = declarations
  }

  const result: IStyleDefinition = { ...definition, rules }

  delete result.applies

  return result
}
