import { IfQualifier } from "@heleonix/hx-core"
import type { IBindingScope, IStyleEffect } from "@heleonix/hx-core"
import type { IBindingExpression, IQualifierUsage } from "@heleonix/hx-language"

class FakeScope implements IBindingScope {
  public readonly subscribed: IBindingExpression[] = []
  private readonly handlers = new Map<string, (() => void)[]>()

  public constructor(
    public readonly state: Record<string, unknown> = {},
    public readonly sources: Record<string, unknown> = {},
  ) {}

  public resolve(binding: IBindingExpression): unknown {
    if (binding.type === "state") {
      return this.state[binding.value]
    }

    if (binding.type === "literal") {
      return JSON.parse(binding.value)
    }

    const source = this.sources[`${binding.type}:${binding.value}`]

    return typeof source === "function" ? (source as () => unknown)() : source
  }

  public subscribe(binding: IBindingExpression, handler: () => void): () => void {
    this.subscribed.push(binding)

    if (binding.type !== "state") {
      return () => {}
    }

    const list = this.handlers.get(binding.value) ?? []
    list.push(handler)
    this.handlers.set(binding.value, list)

    return () =>
      this.handlers.set(
        binding.value,
        (this.handlers.get(binding.value) ?? []).filter((h) => h !== handler),
      )
  }

  public change(prop: string, value: unknown): void {
    this.state[prop] = value

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

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))

  return { promise, resolve }
}

function flush(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0))
}

const qualifier = new IfQualifier()

function usage(args: Record<string, string>): IQualifierUsage {
  return { name: "If", args }
}

function gateAttr(u: IQualifierUsage): string {
  return `data-hx-${(qualifier.build(u) as { gate: string }).gate}`
}

async function gated(args: Record<string, string>, scope: FakeScope): Promise<boolean> {
  const u = usage(args)
  const effect = new FakeEffect()

  await qualifier.attach(u, scope, effect)

  return effect.attrs.has(gateAttr(u))
}

describe("IfQualifier", () => {
  describe("a property subject", () => {
    it("then build gates the rule behind the same data-attribute attach toggles", async () => {
      expect(await gated({ value: "{isSaving}" }, new FakeScope({ isSaving: true }))).toBeTrue()
    })

    it("then toggles the gate as a truthy subject changes", async () => {
      const u = usage({ value: "{isSaving}" })
      const scope = new FakeScope({ isSaving: false })
      const effect = new FakeEffect()

      await qualifier.attach(u, scope, effect)
      expect(effect.attrs.has(gateAttr(u))).toBeFalse()

      scope.change("isSaving", true)
      expect(effect.attrs.has(gateAttr(u))).toBeTrue()
    })

    it("then gives differently-argued usages different gates", () => {
      expect(gateAttr(usage({ value: "{a}" }))).not.toBe(gateAttr(usage({ value: "{b}" })))
    })

    it("then dispose unsubscribes so later changes are ignored", async () => {
      const scope = new FakeScope({ isSaving: false })

      const disposable = await qualifier.attach(usage({ value: "{isSaving}" }), scope, new FakeEffect())
      expect(scope.subscriberCount("isSaving")).toBe(1)

      disposable.dispose()
      expect(scope.subscriberCount("isSaving")).toBe(0)
    })
  })

  describe("property and literal operands", () => {
    it("then compares the subject against an `is` operand, re-evaluating as either side changes", async () => {
      const u = usage({ value: "{variant}", is: "{selected}" })
      const scope = new FakeScope({ variant: "primary", selected: "primary" })
      const effect = new FakeEffect()

      await qualifier.attach(u, scope, effect)
      expect(effect.attrs.has(gateAttr(u))).toBeTrue()

      scope.change("selected", "danger")
      expect(effect.attrs.has(gateAttr(u))).toBeFalse()

      scope.change("variant", "danger")
      expect(effect.attrs.has(gateAttr(u))).toBeTrue()
    })

    it("then compares against a string literal member", async () => {
      expect(await gated({ value: "{variant}", is: "{'primary'}" }, new FakeScope({ variant: "primary" }))).toBeTrue()
    })

    it("then negates with an `isNot` operand", async () => {
      expect(await gated({ value: "{variant}", isNot: "{'danger'}" }, new FakeScope({ variant: "primary" }))).toBeTrue()
      expect(await gated({ value: "{variant}", isNot: "{'danger'}" }, new FakeScope({ variant: "danger" }))).toBeFalse()
    })

    it("then reads bare argument text as raw text, compared lexically and never unit-aware", async () => {
      expect(await gated({ value: "{size}", is: "12px" }, new FakeScope({ size: "12px" }))).toBeTrue()
      expect(await gated({ value: "{size}", is: "12px" }, new FakeScope({ size: "1em" }))).toBeFalse()
    })

    it("then never reads bare text as a property reference", async () => {
      expect(await gated({ value: "{variant}", is: "primary" }, new FakeScope({ variant: "primary" }))).toBeTrue()
      expect(
        await gated({ value: "{variant}", is: "primary" }, new FakeScope({ variant: "x", primary: "x" })),
      ).toBeFalse()
    })

    it("then reads a bare number as a number", async () => {
      expect(await gated({ value: "{rows}", is: "3" }, new FakeScope({ rows: 3 }))).toBeTrue()
      expect(await gated({ value: "{rows}", is: "3" }, new FakeScope({ rows: "3" }))).toBeFalse()
    })
  })

  describe("boolean operands", () => {
    it("then treats `is: {true}` as the bare truthy condition, whatever the subject's type", async () => {
      expect(await gated({ value: "{label}", is: "{true}" }, new FakeScope({ label: "text" }))).toBeTrue()
      expect(await gated({ value: "{label}", is: "{true}" }, new FakeScope({ label: "" }))).toBeFalse()
    })

    it("then `is: {false}` holds while the subject is falsy or unset, which is the negated condition", async () => {
      expect(await gated({ value: "{items}", is: "{false}" }, new FakeScope({}))).toBeTrue()
      expect(await gated({ value: "{items}", is: "{false}" }, new FakeScope({ items: 3 }))).toBeFalse()
    })

    it("then `isNot: {true}` is the same negation as `is: {false}`", async () => {
      expect(await gated({ value: "{loading}", isNot: "{true}" }, new FakeScope({ loading: 0 }))).toBeTrue()
      expect(await gated({ value: "{loading}", isNot: "{true}" }, new FakeScope({ loading: 1 }))).toBeFalse()
    })

    it("then a boolean operand reached through a binding casts the same way", async () => {
      const u = usage({ value: "{label}", is: "{expected}" })
      const scope = new FakeScope({ label: "text", expected: true })
      const effect = new FakeEffect()

      await qualifier.attach(u, scope, effect)
      expect(effect.attrs.has(gateAttr(u))).toBeTrue()

      scope.change("expected", false)
      expect(effect.attrs.has(gateAttr(u))).toBeFalse()
    })

    it("then a non-boolean operand still compares strictly, so 0 is not false", async () => {
      expect(await gated({ value: "{count}", is: "{0}" }, new FakeScope({ count: false }))).toBeFalse()
      expect(await gated({ value: "{count}", is: "{0}" }, new FakeScope({ count: 0 }))).toBeTrue()
    })
  })

  describe("dictionary, config and theme operands", () => {
    it("then compares against a dictionary entry", async () => {
      const scope = new FakeScope({ label: "Save" }, { "dictionary:Buttons.save": Promise.resolve("Save") })

      expect(await gated({ value: "{label}", is: "{@Buttons.save}" }, scope)).toBeTrue()
    })

    it("then compares against a config entry", async () => {
      const scope = new FakeScope({ variant: "compact" }, { "config:Layout.density": Promise.resolve("compact") })

      expect(await gated({ value: "{variant}", is: "{#Layout.density}" }, scope)).toBeTrue()
    })

    it("then compares against a theme token", async () => {
      const scope = new FakeScope({ size: "md" }, { "theme:Sizes.default": Promise.resolve("md") })

      expect(await gated({ value: "{size}", is: "{$Sizes.default}" }, scope)).toBeTrue()
      expect(await gated({ value: "{size}", isNot: "{$Sizes.default}" }, scope)).toBeFalse()
    })

    it("then subscribes to both the subject and the operand source", async () => {
      const scope = new FakeScope({}, { "dictionary:Labels.x": "x" })

      await qualifier.attach(usage({ value: "{label}", is: "{@Labels.x}" }), scope, new FakeEffect())

      expect(scope.subscribed).toEqual([
        { type: "state", value: "label" },
        { type: "dictionary", value: "Labels.x" },
      ])
    })

    it("then lets the newest evaluation win when an older async resolve settles later", async () => {
      const u = usage({ value: "{label}", is: "{@Labels.current}" })
      const pending: { promise: Promise<string>; resolve: (value: string) => void }[] = []
      const scope = new FakeScope(
        { label: "a" },
        {
          "dictionary:Labels.current": () => {
            const next = deferred<string>()
            pending.push(next)

            return next.promise
          },
        },
      )
      const effect = new FakeEffect()

      const attaching = qualifier.attach(u, scope, effect)
      await flush()
      pending[0].resolve("a")
      await attaching
      expect(effect.attrs.has(gateAttr(u))).toBeTrue()

      scope.change("label", "b")
      scope.change("label", "c")
      await flush()

      pending[2].resolve("c")
      await flush()
      pending[1].resolve("x")
      await flush()

      expect(effect.attrs.has(gateAttr(u))).toBeTrue()
    })

    it("then writes nothing for an evaluation that settles after dispose", async () => {
      const u = usage({ value: "{label}", is: "{@Labels.current}" })
      const pending: { promise: Promise<string>; resolve: (value: string) => void }[] = []
      const scope = new FakeScope(
        { label: "a" },
        {
          "dictionary:Labels.current": () => {
            const next = deferred<string>()
            pending.push(next)

            return next.promise
          },
        },
      )
      const effect = new FakeEffect()

      const attaching = qualifier.attach(u, scope, effect)
      await flush()
      pending[0].resolve("x")
      const disposable = await attaching
      expect(effect.attrs.has(gateAttr(u))).toBeFalse()

      scope.change("label", "b")
      await flush()
      disposable.dispose()
      pending[1].resolve("b")
      await flush()

      expect(effect.attrs.has(gateAttr(u))).toBeFalse()
    })
  })
})
