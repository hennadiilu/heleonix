import type { IParsedAssetFileName } from "./IParsedAssetFileName"

const QUERY_KEY = "hx"

/**
 * Reads metadata previously written by {@link encodeAssetMeta} from a loader's
 * `resourceQuery`. Returns `null` for requests without it (e.g. direct imports that
 * bypass the plugin), signalling the loader to fall back to parsing the file name.
 */
export function decodeAssetMeta(resourceQuery: string): IParsedAssetFileName | null {
  const query = resourceQuery.startsWith("?") ? resourceQuery.slice(1) : resourceQuery
  const raw = new URLSearchParams(query).get(QUERY_KEY)

  return raw ? (JSON.parse(raw) as IParsedAssetFileName) : null
}
