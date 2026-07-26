/**
 * A short, deterministic, attribute-safe id (FNV-1a base36, no dependencies).
 * Used to derive a stable gate id from a condition's canonical form so a
 * qualifier's `build` (the `{gate}` fragment) and `attach` (the `data-hx-<id>`
 * it toggles) agree without sharing state.
 */
export function hashId(content: string): string {
  let hash = 2166136261

  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0).toString(36)
}
