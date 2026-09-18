import { Position } from "vscode-languageserver"

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
