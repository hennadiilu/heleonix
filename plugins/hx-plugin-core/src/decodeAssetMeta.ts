import type { IParsedAssetFileName } from "./IParsedAssetFileName"

const QUERY_KEY = "hx"

export function decodeAssetMeta(resourceQuery: string): IParsedAssetFileName | null {
  const query = resourceQuery.startsWith("?") ? resourceQuery.slice(1) : resourceQuery
  const raw = new URLSearchParams(query).get(QUERY_KEY)

  return raw ? (JSON.parse(raw) as IParsedAssetFileName) : null
}
