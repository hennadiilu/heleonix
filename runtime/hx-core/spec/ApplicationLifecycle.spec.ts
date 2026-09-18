import { ActionProvider } from "../src/actions/ActionProvider"
import { Binder } from "../src/bindings/Binder"
import { ComponentManager } from "../src/components/ComponentManager"
import { ConverterProvider } from "../src/converters/ConverterProvider"
import { ServiceProvider } from "../src/services/ServiceProvider"
import { StateManager } from "../src/state/StateManager"
import { EventEmitter, KeyedEventEmitter } from "@heleonix/hx-core"
import type { IActionContext, IConverterContext } from "@heleonix/hx-core"

describe("restart teardown", () => {
  describe("StateManager.clear", () => {
    it("then drops values, so a restarted application reads nothing from the previous run", () => {
      const state = new StateManager()

      state.setValue("App.Card:title", "before")
      expect(state.getValue("App.Card:title")).toBe("before")

      state.clear()

      expect(state.getValue("App.Card:title")).toBeUndefined()
    })

    it("then drops subscriptions, so a stale handler never hears the next run", () => {
      const state = new StateManager()
      let calls = 0

      state.changed.on("App.Card:title", () => {
        calls += 1
      })

      state.setValue("App.Card:title", "a")
      expect(calls).toBe(1)

      state.clear()
      state.setValue("App.Card:title", "b")

      expect(calls).toBe(1)
    })

    it("then still accepts values after clearing, so the store is reusable", () => {
      const state = new StateManager()

      state.setValue("App.Card:title", "before")
      state.clear()
      state.setValue("App.Card:title", "after")

      expect(state.getValue("App.Card:title")).toBe("after")
    })
  })

  describe("Binder.clear", () => {
    it("then drops every binding, so the next run rebinds from scratch", () => {
      const state = new StateManager()
      const binder = new Binder(state, { evaluate: () => undefined } as never)

      state.setValue("App.Source:value", "x")
      void binder.bind("App.Target:value", { type: "state", value: "App.Source:value" } as never, "App")
      expect(binder.getActiveEndpoints("App.Target").length).toBeGreaterThan(0)

      binder.clear()

      expect(binder.getActiveEndpoints("App.Target")).toEqual([])
    })
  })

  describe("ConverterProvider.clear", () => {
    it("then constructs a fresh converter after clearing, not the previous run's instance", () => {
      class Truncate {
        public readonly context: IConverterContext

        public constructor(context: IConverterContext) {
          this.context = context
        }

        public format(value: unknown): unknown {
          return value
        }
      }

      const converters = new ConverterProvider(
        new Map([["Truncate", Truncate as never]]),
        () => ({}) as IConverterContext,
      )

      const first = converters.get("Truncate")
      expect(converters.get("Truncate")).toBe(first)

      converters.clear()

      expect(converters.get("Truncate")).not.toBe(first)
    })
  })

  describe("ComponentManager.clear", () => {
    it("then resets the anonymous counter, so a restarted run names components identically", () => {
      const manager = new ComponentManager(
        { loadDefinition: () => Promise.resolve(undefined) } as never,
        { changed: { on: () => {}, off: () => {} } } as never,
        {} as never,
        {} as never,
        new Map(),
        () => ({}) as never,
        undefined,
      )

      const counterOf = (): number =>
        (manager as unknown as { anonymousComponentCounter: number }).anonymousComponentCounter

      ;(manager as unknown as { anonymousComponentCounter: number }).anonymousComponentCounter = 7

      manager.clear()

      expect(counterOf()).toBe(0)
    })
  })

  describe("emitter clear", () => {
    it("then drops every handler of an EventEmitter", () => {
      const emitter = new EventEmitter<() => void>()
      let calls = 0

      emitter.on(() => {
        calls += 1
      })
      emitter.emit()
      expect(calls).toBe(1)

      emitter.clear()
      emitter.emit()

      expect(calls).toBe(1)
    })

    it("then drops every handler of a KeyedEventEmitter across all keys", () => {
      const emitter = new KeyedEventEmitter<string, (key: string) => void>()
      let calls = 0
      const handler = (): void => {
        calls += 1
      }

      emitter.on("a", handler)
      emitter.on("b", handler)
      emitter.emit("a")
      expect(calls).toBe(1)

      emitter.clear()
      emitter.emit("a")
      emitter.emit("b")

      expect(calls).toBe(1)
    })
  })

  describe("ActionProvider.clear", () => {
    it("then constructs a fresh action after clearing, not the previous run's instance", () => {
      class Submit {
        public Execute(): Promise<void> {
          return Promise.resolve()
        }
      }

      const actions = new ActionProvider(new Map([["Submit", Submit as never]]), {} as IActionContext)

      const first = actions.get("Submit")
      expect(actions.get("Submit")).toBe(first)

      actions.clear()

      expect(actions.get("Submit")).not.toBe(first)
    })
  })

  describe("ServiceProvider.clear", () => {
    it("then constructs a fresh service after clearing, so a restart inherits no run state", () => {
      class Session {
        public readonly opened = Symbol("opened")
      }

      const services = new ServiceProvider(new Set([Session as never]))

      const first = services.get(Session as never)
      expect(services.get(Session as never)).toBe(first)

      services.clear()

      expect(services.get(Session as never)).not.toBe(first)
    })
  })
})
