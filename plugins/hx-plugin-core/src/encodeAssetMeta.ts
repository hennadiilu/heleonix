import type { IParsedAssetFileName } from "./IParsedAssetFileName"

const QUERY_KEY = "hx"

/**
 * Encodes already-parsed file-name metadata into a resource query string that the
 * aggregator's imports carry. The loader decodes it instead of re-parsing the file
 * name, so each source is parsed exactly once (by the plugin during scanning).
 */
export function encodeAssetMeta(meta: IParsedAssetFileName): string {
  return `?${QUERY_KEY}=${encodeURIComponent(JSON.stringify(meta))}`
}
