/**
 * The keyframe context the engine forwards to a rule's compose so the platform
 * can scope animation references: `scope` uniquely namespaces the owning style
 * (its definition name) and `names` are the style-local keyframe names (which
 * shadow same-named theme timelines). A platform rewrites any animation
 * reference to a local name into the scoped keyframe; other names pass through
 * as theme timelines.
 */
export interface IKeyframeScope {
  scope: string

  names: readonly string[]
}
