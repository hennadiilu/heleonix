import { EXT_CONFIG } from "./EXT_CONFIG"
import { EXT_DICTIONARY } from "./EXT_DICTIONARY"
import type { Kind } from "./Kind"
import { EXT_STYLE } from "./EXT_STYLE"
import { EXT_TEMPLATE } from "./EXT_TEMPLATE"
import { EXT_THEME } from "./EXT_THEME"

export const EXT_KIND: Readonly<Record<string, Kind>> = {
  [EXT_TEMPLATE]: "component",
  [EXT_DICTIONARY]: "dictionary",
  [EXT_CONFIG]: "config",
  [EXT_STYLE]: "style",
  [EXT_THEME]: "theme",
}
