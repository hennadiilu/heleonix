import type { DataParams } from "../common/DataParams"
import type { IActionContext } from "./IActionContext"

export abstract class Action<TParams extends DataParams<TParams> = object> {
  public constructor(protected readonly context: IActionContext) {}

  public abstract Execute(params: TParams): Promise<void>
}
