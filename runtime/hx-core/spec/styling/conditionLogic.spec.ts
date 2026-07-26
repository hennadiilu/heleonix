import { buildCondition, attachCondition } from "@heleonix/hx-core"
import type { ComponentStateAccessor, StyleEffect, StyleHandle } from "@heleonix/hx-core"
import type { IQualifierUsage } from "@heleonix/hx-language"

class FakeState implements ComponentStateAccessor {
  public values: Record<string, unknown>
  private readonly handlers = new Map<string, (() => void)[]>()

  public constructor(values: Record<string, unknown>) {
    this.values = values
  }

  public subscribe(prop: string, handler: () => void): () => void {
    const list = this.handlers.get(prop) ?? []
    list.push(handler)
    this.handlers.set(prop, list)

    return () =>
      this.handlers.set(
        prop,
        (this.handlers.get(prop) ?? []).filter((h) => h !== handler),
      )
  }

  public getValue(prop: string): unknown {
    return this.values[prop]
  }

  public change(prop: string, value: unknown): void {
    this.values[prop] = value

    for (const handler of [...(this.handlers.get(prop) ?? [])]) {
      handler()
    }
  }

  public subscriberCount(prop: string): number {
    return (this.handlers.get(prop) ?? []).length
  }
}

class FakeEffect implements StyleEffect {
  public readonly attrs = new Map<string, string>()
  public setAttribute(name: string, value: string): void {
    this.attrs.set(name, value)
  }
  public removeAttribute(name: string): void {
    this.attrs.delete(name)
  }
  public setVariable(): void {}
  public removeVariable(): void {}
  public setClass(_handle: StyleHandle): void {}
  public removeClass(_handle: StyleHandle): void {}
  public setProperty(): void {}
  public removeProperty(): void {}
}

function usage(args: Record<string, string>): IQualifierUsage {
  return { name: "If", args }
}

function gateAttr(u: IQualifierUsage): string {
  return `data-hx-${(buildCondition(u) as { gate: string }).gate}`
}

describe("condition qualifier logic", () => {
  it("then build gates the rule behind the same data-attribute attach toggles", () => {
    const u = usage({ value: "{isSaving}" })
    const state = new FakeState({ isSaving: true })
    const effect = new FakeEffect()

    attachCondition(u, state, effect, false)

    expect(effect.attrs.has(gateAttr(u))).toBeTrue()
  })

  it("then toggles the gate as a truthy subject changes", () => {
    const u = usage({ value: "{isSaving}" })
    const state = new FakeState({ isSaving: false })
    const effect = new FakeEffect()

    attachCondition(u, state, effect, false)
    expect(effect.attrs.has(gateAttr(u))).toBeFalse()

    state.change("isSaving", true)
    expect(effect.attrs.has(gateAttr(u))).toBeTrue()
  })

  it("then compares the subject against an `is` operand", () => {
    const u = usage({ value: "{variant}", is: "{'primary'}" })
    const state = new FakeState({ variant: "primary" })
    const effect = new FakeEffect()

    attachCondition(u, state, effect, false)
    expect(effect.attrs.has(gateAttr(u))).toBeTrue()

    state.change("variant", "danger")
    expect(effect.attrs.has(gateAttr(u))).toBeFalse()
  })

  it("then @hx-unless negates: the gate is present while the subject is falsy", () => {
    const u = usage({ value: "{loading}" })
    const state = new FakeState({ loading: false })
    const effect = new FakeEffect()

    attachCondition(u, state, effect, true)
    expect(effect.attrs.has(gateAttr(u))).toBeTrue()

    state.change("loading", true)
    expect(effect.attrs.has(gateAttr(u))).toBeFalse()
  })

  it("then dispose unsubscribes so later changes are ignored", () => {
    const u = usage({ value: "{isSaving}" })
    const state = new FakeState({ isSaving: false })

    const disposable = attachCondition(u, state, new FakeEffect(), false)
    expect(state.subscriberCount("isSaving")).toBe(1)

    disposable.dispose()
    expect(state.subscriberCount("isSaving")).toBe(0)
  })
})
