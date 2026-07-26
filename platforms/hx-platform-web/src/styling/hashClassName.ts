/**
 * A deterministic, content-hashed class name for a composed rule (FNV-1a, no
 * dependencies). Identical content yields the same name, so byte-identical rules
 * share one class document-wide, and the server and client produce the same
 * names for SSR - hydration finds an identical stylesheet.
 */
export function hashClassName(content: string): string {
  let hash = 2166136261

  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  return `hx-${(hash >>> 0).toString(36)}`
}
