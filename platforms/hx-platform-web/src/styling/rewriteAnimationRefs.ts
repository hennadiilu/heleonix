import { scopedKeyframeName } from "./scopedKeyframeName"

const ANIMATION_PROPERTIES = new Set(["animation", "animation-name"])

/**
 * Rewrites `animation`/`animation-name` values so any whole token naming a
 * style-local keyframe becomes its {@link scopedKeyframeName}; every other token
 * (durations, easings, theme timelines) passes through untouched. Values are
 * space/comma-separated, so tokenizing on those boundaries is enough.
 */
export function rewriteAnimationRefs(
  declarations: Readonly<Record<string, string>>,
  localNames: readonly string[],
  scope: string,
): Record<string, string> {
  const result: Record<string, string> = {}

  for (const [property, value] of Object.entries(declarations)) {
    result[property] =
      localNames.length > 0 && ANIMATION_PROPERTIES.has(property)
        ? value.replace(/[^\s,]+/g, (token) => (localNames.includes(token) ? scopedKeyframeName(scope, token) : token))
        : value
  }

  return result
}
