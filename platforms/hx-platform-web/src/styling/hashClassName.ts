export function hashClassName(content: string): string {
  let hash = 2166136261

  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  return `hx-${(hash >>> 0).toString(36)}`
}
