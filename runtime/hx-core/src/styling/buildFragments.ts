import { parseRuleKey } from "@heleonix/hx-language"
import type { QualifierRegistry } from "./QualifierRegistry"
import type { StyleFragment } from "./StyleFragment"

/**
 * Builds the neutral {@link StyleFragment}s of a compiled rule key: each
 * `&`-joined segment is dispatched to its registered qualifier's `build`.
 * Segments whose qualifier is attach-only (e.g. `@hx-if`) or unregistered
 * contribute no fragment - composing the fragments into a selector is the
 * platform's job. Pure (build is once-per-signature and side-effect free).
 */
export function buildFragments(ruleKey: string, registry: QualifierRegistry): StyleFragment[] {
  const fragments: StyleFragment[] = []

  for (const usage of parseRuleKey(ruleKey)) {
    const fragment = registry.get(usage.name)?.build?.(usage)

    if (fragment) {
      fragments.push(fragment)
    }
  }

  return fragments
}
