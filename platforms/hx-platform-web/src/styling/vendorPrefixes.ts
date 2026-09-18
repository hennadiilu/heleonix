const PREFIXES: Readonly<Record<string, readonly string[]>> = {
  appearance: ["-webkit-appearance"],
  "user-select": ["-webkit-user-select"],
  "backdrop-filter": ["-webkit-backdrop-filter"],
  "background-clip": ["-webkit-background-clip"],
  "clip-path": ["-webkit-clip-path"],
  hyphens: ["-webkit-hyphens"],
  mask: ["-webkit-mask"],
}

export function vendorPrefixes(property: string): readonly string[] {
  return PREFIXES[property] ?? []
}
