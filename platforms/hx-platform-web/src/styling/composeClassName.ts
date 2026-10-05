import type { StyleFragment } from "@heleonix/hx-core"
import { hashClassName } from "./hashClassName"

// Derived from the whole compose input, so a rule whose environment resolves
// differently (another dimension's theme) gets its own class and sheet entry.
export function composeClassName(
  signature: string,
  fragments: readonly StyleFragment[],
  declarations: Readonly<Record<string, string>>,
): string {
  return hashClassName(`${signature} ${JSON.stringify(fragments)} ${JSON.stringify(declarations)}`)
}
