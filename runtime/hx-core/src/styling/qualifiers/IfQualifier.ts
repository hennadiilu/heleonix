import { isLiteralSource, parseBindingExpression, stringifyQualifierUsage } from "@heleonix/hx-language"
import type { IBindingExpression, IQualifierUsage } from "@heleonix/hx-language"
import { StyleQualifier } from "./StyleQualifier"
import type { IBindingScope } from "./IBindingScope"
import type { IIfQualifierArgs } from "./IIfQualifierArgs"
import type { IDisposable } from "../../common/IDisposable"
import type { MaybePromise } from "../../common/MaybePromise"
import { thenMaybe } from "../../common/thenMaybe"
import type { IStyleEffect } from "../../platform/IStyleEffect"
import type { StyleFragment } from "../StyleFragment"

const TRUTHY: IBindingExpression = { type: "literal", value: "true" }

export class IfQualifier extends StyleQualifier<IIfQualifierArgs> {
  public static readonly hxName = "If"

  public build(usage: IQualifierUsage): StyleFragment {
    return { gate: this.gateOf(usage) }
  }

  public async attach(usage: IQualifierUsage, scope: IBindingScope, effect: IStyleEffect): Promise<IDisposable> {
    const attribute = `data-hx-${this.gateOf(usage)}`
    const subject = this.sourceOf(usage.args["value"] ?? "")
    const negated = usage.args["is"] === undefined && usage.args["isNot"] !== undefined
    const comparand = usage.args["is"] ?? usage.args["isNot"]
    const operand = comparand === undefined ? TRUTHY : this.sourceOf(comparand)

    let disposed = false
    let latest = 0

    // Each run is numbered so a slow resolve that settles after a newer one
    // cannot overwrite the newer outcome, and nothing writes once disposed.
    const evaluate = (): MaybePromise<void> => {
      const run = ++latest

      return thenMaybe(this.holds(scope, subject, operand, negated), (holds) => {
        if (disposed || run !== latest) {
          return
        }

        if (holds) {
          effect.setAttribute(attribute, "")
        } else {
          effect.removeAttribute(attribute)
        }
      })
    }

    const unsubscribes = await Promise.all(
      [subject, operand].map((source) => Promise.resolve(scope.subscribe(source, () => void evaluate()))),
    )

    await evaluate()

    return {
      dispose: () => {
        disposed = true

        unsubscribes.forEach((unsubscribe) => unsubscribe())
      },
    }
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

  // Braces mark a binding source - a property, `{'member'}`, `{@Dict.key}`,
  // `{#Config.path}` or `{$Theme.token}`. Bare argument text is a literal: a
  // number or boolean as typed, anything else the raw text itself (`12px`).
  private sourceOf(raw: string): IBindingExpression {
    if (raw.length >= 2 && raw.charAt(0) === "{" && raw.charAt(raw.length - 1) === "}") {
      return parseBindingExpression(raw.slice(1, -1))
    }

    return { type: "literal", value: isLiteralSource(raw) ? raw : JSON.stringify(raw) }
  }

  private holds(
    scope: IBindingScope,
    subject: IBindingExpression,
    operand: IBindingExpression,
    negated: boolean,
  ): MaybePromise<boolean> {
    return thenMaybe(scope.resolve(subject), (actual) =>
      thenMaybe(scope.resolve(operand), (expected) => this.equals(actual, expected) !== negated),
    )
  }

  // A boolean operand compares the subject's truthiness rather than its identity,
  // so any subject can be tested for presence: `is: {true}` is the bare condition
  // and `is: {false}` / `isNot: {true}` its negation. Strict equality against a
  // boolean would be dead for every non-boolean subject, so nothing is lost.
  private equals(subject: unknown, operand: unknown): boolean {
    return typeof operand === "boolean" ? Boolean(subject) === operand : subject === operand
  }
}
