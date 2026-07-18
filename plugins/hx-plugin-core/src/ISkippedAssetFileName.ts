/**
 * Returned instead of a parsed result when a file name carries a dimension-like
 * segment that matches none of this build's configured dimensions. The file is a
 * deliberate non-candidate (or a typo); `unmatchedSegment` lets callers report it.
 */
export interface ISkippedAssetFileName {
  skipped: true
  unmatchedSegment: string
}
