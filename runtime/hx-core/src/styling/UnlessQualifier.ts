import type { IQualifierUsage } from "@heleonix/hx-language"
import { StyleQualifier } from "./StyleQualifier"
import { attachCondition, buildCondition } from "./conditionLogic"
import type { ComponentStateAccessor } from "./ComponentStateAccessor"
import type { IDisposable } from "./IDisposable"
import type { StyleEffect } from "./StyleEffect"
import type { StyleFragment } from "./StyleFragment"

/**
 * The built-in `@hx-unless` qualifier (registered under `Unless`): the negation
 * of `@hx-if` - applies its rule while the `value:` subject is falsy or unset.
 */
export class UnlessQualifier extends StyleQualifier {
  public static get diName(): string {
    return "UnlessQualifier"
  }

  public build(usage: IQualifierUsage): StyleFragment {
    return buildCondition(usage)
  }

  public attach(usage: IQualifierUsage, state: ComponentStateAccessor, effect: StyleEffect): IDisposable {
    return attachCondition(usage, state, effect, true)
  }
}
