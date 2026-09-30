import type { IDimension } from "@heleonix/hx-language"
import type { IDimensionProvider } from "./IDimensionProvider"

export interface IDimensionController extends IDimensionProvider {
  update(diff: IDimension): void
}
