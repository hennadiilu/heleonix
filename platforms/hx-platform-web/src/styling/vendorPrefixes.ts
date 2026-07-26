const PREFIXES: Readonly<Record<string, readonly string[]>> = {
  appearance: ["-webkit-appearance"],
  "user-select": ["-webkit-user-select"],
  "backdrop-filter": ["-webkit-backdrop-filter"],
  "background-clip": ["-webkit-background-clip"],
  "clip-path": ["-webkit-clip-path"],
  hyphens: ["-webkit-hyphens"],
  mask: ["-webkit-mask"],
}

/**
 * The vendor-prefixed property names to emit ahead of a standard CSS property,
 * for the curated set still needing a `-webkit-` alias in current engines. Empty
 * for everything else. Kept as a small, explicit table (no autoprefixer data
 * dependency) - extend it deliberately as real needs arise.
 */
export function vendorPrefixes(property: string): readonly string[] {
  return PREFIXES[property] ?? []
}
