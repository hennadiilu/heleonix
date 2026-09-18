import { IfQualifier } from "@heleonix/hx-core"
import type { IComponentState, IStyleEffect, IStyleQualifierContext } from "@heleonix/hx-core"
import type { IQualifierUsage } from "@heleonix/hx-language"

class FakeComponentState implements IComponentState {
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

class FakeEffect implements IStyleEffect {
  public readonly attrs = new Map<string, string>()
  public setAttribute(name: string, value: string): void {
    this.attrs.set(name, value)
  }
  public removeAttribute(name: string): void {
    this.attrs.delete(name)
  }
  public setVariable(): void {}
  public removeVariable(): void {}
  public setClass(): void {}
  public removeClass(): void {}
  public setProperty(): void {}
  public removeProperty(): void {}
}

function qualifier(): IfQualifier {
  return new IfQualifier({} as IStyleQualifierContext)
}

function usage(args: Record<string, string>): IQualifierUsage {
  return { name: "If", args }
}

function gateAttr(u: IQualifierUsage): string {
  return `data-hx-${(qualifier().build(u) as { gate: string }).gate}`
}

describe("IfQualifier", () => {
  it("then build gates the rule behind the same data-attribute attach toggles", () => {
    const u = usage({ value: "{isSaving}" })
    const state = new FakeComponentState({ isSaving: true })
    const effect = new FakeEffect()

    qualifier().attach(u, state, effect)

    expect(effect.attrs.has(gateAttr(u))).toBeTrue()
  })

  it("then toggles the gate as a truthy subject changes", () => {
    const u = usage({ value: "{isSaving}" })
    const state = new FakeComponentState({ isSaving: false })
    const effect = new FakeEffect()

    qualifier().attach(u, state, effect)
    expect(effect.attrs.has(gateAttr(u))).toBeFalse()

    state.change("isSaving", true)
    expect(effect.attrs.has(gateAttr(u))).toBeTrue()
  })

  it("then compares the subject against an `is` operand", () => {
    const u = usage({ value: "{variant}", is: "{'primary'}" })
    const state = new FakeComponentState({ variant: "primary" })
    const effect = new FakeEffect()

    qualifier().attach(u, state, effect)
    expect(effect.attrs.has(gateAttr(u))).toBeTrue()

    state.change("variant", "danger")
    expect(effect.attrs.has(gateAttr(u))).toBeFalse()
  })

  it("then negates with an `isNot` operand", () => {
    const u = usage({ value: "{variant}", isNot: "{'danger'}" })
    const state = new FakeComponentState({ variant: "primary" })
    const effect = new FakeEffect()

    qualifier().attach(u, state, effect)
    expect(effect.attrs.has(gateAttr(u))).toBeTrue()

    state.change("variant", "danger")
    expect(effect.attrs.has(gateAttr(u))).toBeFalse()
  })

  it("then treats `is: {true}` as the bare truthy condition, whatever the subject's type", () => {
    const u = usage({ value: "{label}", is: "{true}" })
    const state = new FakeComponentState({ label: "text" })
    const effect = new FakeEffect()

    qualifier().attach(u, state, effect)
    expect(effect.attrs.has(gateAttr(u))).toBeTrue()

    state.change("label", "")
    expect(effect.attrs.has(gateAttr(u))).toBeFalse()
  })

  it("then `is: {false}` holds while the subject is falsy or unset, which is the negated condition", () => {
    const u = usage({ value: "{items}", is: "{false}" })
    const state = new FakeComponentState({})
    const effect = new FakeEffect()

    qualifier().attach(u, state, effect)
    expect(effect.attrs.has(gateAttr(u))).toBeTrue()

    state.change("items", 3)
    expect(effect.attrs.has(gateAttr(u))).toBeFalse()
  })

  it("then `isNot: {true}` is the same negation as `is: {false}`", () => {
    const u = usage({ value: "{loading}", isNot: "{true}" })
    const state = new FakeComponentState({ loading: 0 })
    const effect = new FakeEffect()

    qualifier().attach(u, state, effect)
    expect(effect.attrs.has(gateAttr(u))).toBeTrue()

    state.change("loading", 1)
    expect(effect.attrs.has(gateAttr(u))).toBeFalse()
  })

  it("then a boolean operand reached through a binding casts the same way", () => {
    const u = usage({ value: "{label}", is: "{expected}" })
    const state = new FakeComponentState({ label: "text", expected: true })
    const effect = new FakeEffect()

    qualifier().attach(u, state, effect)
    expect(effect.attrs.has(gateAttr(u))).toBeTrue()

    state.change("expected", false)
    expect(effect.attrs.has(gateAttr(u))).toBeFalse()
  })

  it("then a non-boolean operand still compares strictly, so 0 is not false", () => {
    const u = usage({ value: "{count}", is: "{0}" })
    const state = new FakeComponentState({ count: false })
    const effect = new FakeEffect()

    qualifier().attach(u, state, effect)
    expect(effect.attrs.has(gateAttr(u))).toBeFalse()

    state.change("count", 0)
    expect(effect.attrs.has(gateAttr(u))).toBeTrue()
  })

  it("then gives differently-argued usages different gates", () => {
    expect(gateAttr(usage({ value: "{a}" }))).not.toBe(gateAttr(usage({ value: "{b}" })))
  })

  it("then dispose unsubscribes so later changes are ignored", () => {
    const u = usage({ value: "{isSaving}" })
    const state = new FakeComponentState({ isSaving: false })

    const disposable = qualifier().attach(u, state, new FakeEffect())
    expect(state.subscriberCount("isSaving")).toBe(1)

    disposable.dispose()
    expect(state.subscriberCount("isSaving")).toBe(0)
  })
})
