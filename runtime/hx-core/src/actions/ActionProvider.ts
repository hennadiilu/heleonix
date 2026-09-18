import type { Action } from "./Action"
import type { ActionConstructor } from "./ActionConstructor"
import type { IActionContext } from "./IActionContext"
import type { IActionProvider } from "./IActionProvider"
import { HeleonixError } from "../errors/HeleonixError"
import { Errors } from "../errors/Errors"
import type { IClearable } from "../common/IClearable"

export class ActionProvider implements IActionProvider, IClearable {
  private readonly instances = new Map<string, Action>()

  public constructor(
    private readonly actionCtors: ReadonlyMap<string, ActionConstructor>,
    private readonly context: IActionContext,
  ) {}

  public clear(): void {
    this.instances.clear()
  }

  public get(name: string): Action {
    let instance = this.instances.get(name)

    if (!instance) {
      const ctor = this.actionCtors.get(name)

      if (!ctor) {
        throw new HeleonixError(Errors.unknownAction, name)
      }

      instance = new ctor(this.context)
      this.instances.set(name, instance)
    }

    return instance
  }
}
