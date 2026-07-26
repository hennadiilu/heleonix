/**
 * Resolves a `@hx-style(for: ...)` scope path (dot-joined control names) against
 * a styling component to the descendant components its rule should target, so
 * the engine applies that rule's class to them instead of the styling
 * component's own root. Returns an empty list when nothing matches (the rule is
 * skipped). Absent from the engine (e.g. SSR), scoped rules are skipped entirely.
 */
export interface StyleScopeResolver<TComponent> {
  resolve(component: TComponent, path: string): readonly TComponent[]
}
