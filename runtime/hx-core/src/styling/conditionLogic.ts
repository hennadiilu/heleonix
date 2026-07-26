import { parseBindingExpression, stringifyQualifierUsage } from "@heleonix/hx-language"
import type { IQualifierUsage } from "@heleonix/hx-language"
import { hashId } from "./hashId"
import type { ComponentStateAccessor } from "./ComponentStateAccessor"
import type { IDisposable } from "./IDisposable"
import type { StyleEffect } from "./StyleEffect"
import type { StyleFragment } from "./StyleFragment"

/** The gate id a condition builds and toggles (stable across build/attach). */
function gateOf(usage: IQualifierUsage): string {
  return hashId(stringifyQualifierUsage(usage))
}

/**
 * The build half of `@hx-if`/`@hx-unless`: a `gate` fragment the platform maps
 * to `[data-hx-<id>]`, so the rule's class only applies while the gate attribute
 * is present.
 */
export function buildCondition(usage: IQualifierUsage): StyleFragment {
  return { gate: gateOf(usage) }
}

/**
 * The attach half: subscribes to the condition's subject (and any state operand)
 * and toggles the `data-hx-<id>` gate attribute so the class applies exactly when
 * the condition holds. `negate` flips it for `@hx-unless`.
 */
export function attachCondition(
  usage: IQualifierUsage,
  state: ComponentStateAccessor,
  effect: StyleEffect,
  negate: boolean,
): IDisposable {
  const attribute = `data-hx-${gateOf(usage)}`

  const evaluate = (): void => {
    const holds = negate ? !isTruthy(usage, state) : matches(usage, state)

    if (holds) {
      effect.setAttribute(attribute, "")
    } else {
      effect.removeAttribute(attribute)
    }
  }

  const unsubscribes = stateProps(usage).map((prop) => state.subscribe(prop, evaluate))

  evaluate()

  return { dispose: () => unsubscribes.forEach((unsubscribe) => unsubscribe()) }
}

/** Whether the condition holds: truthy subject, or subject `is`/`isNot` an operand. */
function matches(usage: IQualifierUsage, state: ComponentStateAccessor): boolean {
  const subject = state.getValue(subjectProp(usage))

  if (usage.args["is"] !== undefined) {
    return subject === operand(usage.args["is"], state)
  }

  if (usage.args["isNot"] !== undefined) {
    return subject !== operand(usage.args["isNot"], state)
  }

  return Boolean(subject)
}

function isTruthy(usage: IQualifierUsage, state: ComponentStateAccessor): boolean {
  return Boolean(state.getValue(subjectProp(usage)))
}

/** The state property the `value:` subject reads. */
function subjectProp(usage: IQualifierUsage): string {
  const binding = parseBindingExpression(stripBraces(usage.args["value"] ?? ""))

  return binding.type === "state" ? binding.value : ""
}

/** The resolved operand of a comparison argument: a literal's value or another property's value. */
function operand(raw: string, state: ComponentStateAccessor): unknown {
  const binding = parseBindingExpression(stripBraces(raw))

  if (binding.type === "literal") {
    return safeParse(binding.value)
  }

  return binding.type === "state" ? state.getValue(binding.value) : undefined
}

/** Every state property the condition depends on: its subject plus any state operand. */
function stateProps(usage: IQualifierUsage): string[] {
  const props = [subjectProp(usage)]

  for (const argument of ["is", "isNot"] as const) {
    const raw = usage.args[argument]

    if (raw) {
      const binding = parseBindingExpression(stripBraces(raw))

      if (binding.type === "state") {
        props.push(binding.value)
      }
    }
  }

  return props.filter(Boolean)
}

function stripBraces(raw: string): string {
  return raw.length >= 2 && raw.charAt(0) === "{" && raw.charAt(raw.length - 1) === "}" ? raw.slice(1, -1) : raw
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}
