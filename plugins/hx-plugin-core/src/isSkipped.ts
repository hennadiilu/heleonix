import type { AssetFileNameResult } from "./AssetFileNameResult"
import type { ISkippedAssetFileName } from "./ISkippedAssetFileName"

export function isSkipped(result: AssetFileNameResult): result is ISkippedAssetFileName {
  return (result as ISkippedAssetFileName).skipped === true
}
