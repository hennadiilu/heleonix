import { CONFIG_REF_PREFIX } from "./CONFIG_REF_PREFIX"
import { DICTIONARY_REF_PREFIX } from "./DICTIONARY_REF_PREFIX"
import type { ReferenceType } from "./ReferenceType"

/** Leading character that introduces each reference kind, e.g. `@Name.entry`, `#Name.entry`. */
export const REFERENCE_PREFIXES: Readonly<Record<ReferenceType, string>> = {
  dictionary: DICTIONARY_REF_PREFIX,
  config: CONFIG_REF_PREFIX,
}
