import type { IQualifierUsage } from "@heleonix/hx-language"
import { StyleQualifier } from "./StyleQualifier"
import { attachCondition, buildCondition } from "./conditionLogic"
import type { ComponentStateAccessor } from "./ComponentStateAccessor"
import type { IDisposable } from "./IDisposable"
import type { StyleEffect } from "./StyleEffect"
import type { StyleFragment } from "./StyleFragment"

/**
 * The built-in `@hx-if` qualifier (registered under `If`): applies its rule while
 * the `value:` subject is truthy, or matches an `is:`/`isNot:` operand. `build`
 * gates the rule behind a `data-*` attribute; `attach` toggles it reactively.
 */
export class IfQualifier extends StyleQualifier {
  public static get diName(): string {
    return "IfQualifier"
  }

  public build(usage: IQualifierUsage): StyleFragment {
    return buildCondition(usage)
  }

  public attach(usage: IQualifierUsage, state: ComponentStateAccessor, effect: StyleEffect): IDisposable {
    return attachCondition(usage, state, effect, false)
  }
}
