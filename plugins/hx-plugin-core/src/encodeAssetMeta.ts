import type { IParsedAssetFileName } from "./IParsedAssetFileName"

const QUERY_KEY = "hx"

export function encodeAssetMeta(meta: IParsedAssetFileName): string {
  return `?${QUERY_KEY}=${encodeURIComponent(JSON.stringify(meta))}`
}
