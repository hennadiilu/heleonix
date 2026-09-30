import type { IDimension } from "@heleonix/hx-language"
import type { IEventEmitter } from "../common/IEventEmitter"
import type { IDimensionController } from "./IDimensionController"

export interface IDimensionManager extends IDimensionController {
  readonly changed: IEventEmitter<(dimension: IDimension) => void>
}
