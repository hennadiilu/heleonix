import { Position } from "vscode-languageserver"

/**
 * Maps an absolute offset to an LSP {@link Position} using precomputed
 * {@link lineStartsOf} offsets (binary search for the containing line). The
 * character is the UTF-16 distance from the line start, matching LSP's position
 * semantics for the ASCII identifiers occurrences point at.
 */
export function offsetToPosition(lineStarts: readonly number[], offset: number): Position {
  let low = 0
  let high = lineStarts.length - 1

  while (low < high) {
    const mid = (low + high + 1) >> 1

    if (lineStarts[mid] <= offset) {
      low = mid
    } else {
      high = mid - 1
    }
  }

  return { line: low, character: offset - lineStarts[low] }
}
