/**
 * The CSS `@keyframes` name a style-local timeline is emitted under, namespaced
 * by the owning style's scope so two components can each declare `pulse` without
 * colliding. Names not scoped this way stay verbatim theme-timeline references.
 */
export function scopedKeyframeName(scope: string, name: string): string {
  return `hx-${scope}-${name}`
}
