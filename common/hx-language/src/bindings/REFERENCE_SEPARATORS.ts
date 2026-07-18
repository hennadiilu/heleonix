import { CONFIG_ENTRY_SEPARATOR } from "../names/CONFIG_ENTRY_SEPARATOR"
import { DICTIONARY_ENTRY_SEPARATOR } from "../names/DICTIONARY_ENTRY_SEPARATOR"
import type { ReferenceType } from "./ReferenceType"

/** Separator between a reference's name and its entry, e.g. `@Name.entry`. */
export const REFERENCE_SEPARATORS: Readonly<Record<ReferenceType, string>> = {
  dictionary: DICTIONARY_ENTRY_SEPARATOR,
  config: CONFIG_ENTRY_SEPARATOR,
}
