import type { IDocsEntry } from "./IDocsEntry"

/**
 * A docs artifact: per-file sidecars (`*.docs.json`) and bundled package docs
 * share this one shape, so bundling is a concatenation of `entries` plus the
 * package envelope, and consumers (language server, documentation portals)
 * read both forms identically. `package`/`version` are filled by the bundler
 * and absent in sidecars.
 */
export interface IDocsManifest {
  package?: string

  version?: string

  entries: IDocsEntry[]
}
