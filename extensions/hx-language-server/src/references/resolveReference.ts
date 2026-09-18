import { ReferenceType } from "@heleonix/hx-language"
import { DefinitionIndex } from "../index/DefinitionIndex"
import { REFERENCE_MESSAGES } from "./referenceMessages"

export function referenceIssue(
  kind: ReferenceType,
  name: string,
  entry: string,
  index: DefinitionIndex,
): string | undefined {
  if (!index.hasName(kind, name)) {
    return REFERENCE_MESSAGES.unknownName(kind, name)
  }

  if (!index.hasEntry(kind, name, entry)) {
    return REFERENCE_MESSAGES.unknownEntry(kind, name, entry)
  }

  return undefined
}
