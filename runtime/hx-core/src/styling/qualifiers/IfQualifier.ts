import { parseBindingExpression, stringifyQualifierUsage } from "@heleonix/hx-language"
import type { IQualifierUsage } from "@heleonix/hx-language"
import { StyleQualifier } from "./StyleQualifier"
import type { IComponentState } from "./IComponentState"
import type { IDisposable } from "../../common/IDisposable"
import type { IStyleEffect } from "../../platform/IStyleEffect"
import type { StyleFragment } from "../StyleFragment"

export class IfQualifier extends StyleQualifier {
  public static readonly hxName = "If"

  public build(usage: IQualifierUsage): StyleFragment {
    return { gate: this.gateOf(usage) }
  }

  public attach(usage: IQualifierUsage, state: IComponentState, effect: IStyleEffect): IDisposable {
    const attribute = `data-hx-${this.gateOf(usage)}`

    const evaluate = (): void => {
      if (this.matches(usage, state)) {
        effect.setAttribute(attribute, "")
      } else {
        effect.removeAttribute(attribute)
      }
    }

    const unsubscribes = this.stateProps(usage).map((prop) => state.subscribe(prop, evaluate))

    evaluate()

    return { dispose: () => unsubscribes.forEach((unsubscribe) => unsubscribe()) }
  }

  private gateOf(usage: IQualifierUsage): string {
    let hash = 2166136261
    const content = stringifyQualifierUsage(usage)

    for (let i = 0; i < content.length; i++) {
      hash ^= content.charCodeAt(i)
      hash = Math.imul(hash, 16777619)
    }

    return (hash >>> 0).toString(36)
  }

  private matches(usage: IQualifierUsage, state: IComponentState): boolean {
    const subject = state.getValue(this.subjectProp(usage))

    if (usage.args["is"] !== undefined) {
      return this.equals(subject, this.operand(usage.args["is"], state))
    }

    if (usage.args["isNot"] !== undefined) {
      return !this.equals(subject, this.operand(usage.args["isNot"], state))
    }

    return this.equals(subject, true)
  }

  // A boolean operand compares the subject's truthiness rather than its identity,
  // so any subject can be tested for presence: `is: {true}` is the bare condition
  // and `is: {false}` / `isNot: {true}` its negation. Strict equality against a
  // boolean would be dead for every non-boolean subject, so nothing is lost.
  private equals(subject: unknown, operand: unknown): boolean {
    return typeof operand === "boolean" ? Boolean(subject) === operand : subject === operand
  }

  private subjectProp(usage: IQualifierUsage): string {
    const binding = parseBindingExpression(this.stripBraces(usage.args["value"] ?? ""))

    return binding.type === "state" ? binding.value : ""
  }

  private operand(raw: string, state: IComponentState): unknown {
    const binding = parseBindingExpression(this.stripBraces(raw))

    if (binding.type === "literal") {
      return this.safeParse(binding.value)
    }

    return binding.type === "state" ? state.getValue(binding.value) : undefined
  }

  private stateProps(usage: IQualifierUsage): string[] {
    const props = [this.subjectProp(usage)]

    for (const argument of ["is", "isNot"] as const) {
      const raw = usage.args[argument]

      if (raw) {
        const binding = parseBindingExpression(this.stripBraces(raw))

        if (binding.type === "state") {
          props.push(binding.value)
        }
      }
    }

    return props.filter(Boolean)
  }

  private stripBraces(raw: string): string {
    return raw.length >= 2 && raw.charAt(0) === "{" && raw.charAt(raw.length - 1) === "}" ? raw.slice(1, -1) : raw
  }

  private safeParse(raw: string): unknown {
    try {
      return JSON.parse(raw)
    } catch {
      return raw
    }
  }
}
