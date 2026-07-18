import type { IDocsManifest } from "@heleonix/hx-language"

/**
 * Bundles per-file docs manifests (`*.docs.json` sidecars) into one
 * {@link IDocsManifest} for documentation portals and single-artifact
 * consumers. Sidecars and the bundle share the same shape, so bundling is a
 * concatenation of `entries` plus the package envelope - shipping the bundle
 * is optional and complements (not replaces) the per-file sidecars.
 */
export function bundleDocs(
  manifests: readonly IDocsManifest[],
  info?: { package?: string; version?: string },
): IDocsManifest {
  const result: IDocsManifest = { entries: manifests.flatMap((manifest) => manifest.entries ?? []) }

  if (info?.package) {
    result.package = info.package
  }

  if (info?.version) {
    result.version = info.version
  }

  return result
}
