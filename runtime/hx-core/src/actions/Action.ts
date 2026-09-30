import type { DataObject } from "../common/DataObject"
import type { IActionContext } from "./IActionContext"

export abstract class Action<TParams extends DataObject<TParams> = object> {
  public constructor(protected readonly context: IActionContext) {}

  public abstract Execute(params: TParams): Promise<void>
}
