import {
  AggregateDefinitionSource,
  Application,
  ApplicationRuntime,
  BindingEvaluator,
  DefinitionLoader,
  LiteralValueSource,
  StateValueSource,
} from "@heleonix/hx-core"
import { ConverterProvider } from "../src/converters/ConverterProvider"
import { StateManager } from "../src/state/StateManager"
import type { IApplicationBootstrap, IComponentDriver, IScheduler, IStyleDriver, IThemeDriver } from "@heleonix/hx-core"
import type { IBindingExpression, IDimension, IThemeDefinition } from "@heleonix/hx-language"

const calls = { start: 0, stop: 0, rootHost: 0, tokens: 0 }

class StubRuntime extends ApplicationRuntime {
  public get componentDriver(): IComponentDriver {
    return {
      getRootHost: () => {
        calls.rootHost += 1

        return null
      },
    }
  }

  public get themeDriver(): IThemeDriver {
    return {
      applyTokens: () => {
        calls.tokens += 1
      },
      applyArtifacts: () => {},
    }
  }

  public get styleDriver(): IStyleDriver {
    return {
      compose: () => ({}) as never,
      release: () => {},
      effectFor: () => ({}) as never,
    }
  }

  public get scheduler(): IScheduler {
    return { scheduleCompute: () => {}, scheduleCommit: () => {} }
  }

  public override start(): void {
    calls.start += 1
  }

  public stop(): void {
    calls.stop += 1
  }
}

class TestApplication extends Application {
  public constructor(bootstrap?: Omit<IApplicationBootstrap, "runtime">) {
    super("TestApplication", { ...bootstrap, runtime: StubRuntime })
  }

  public switchDimension(diff: IDimension): void {
    this.dimensions.update(diff)
  }
}

class ThemeSource extends AggregateDefinitionSource<IThemeDefinition> {
  public loadDefinitions(): Promise<readonly IThemeDefinition[]> {
    return Promise.resolve([{ name: "", dimension: {}, groups: { Spacing: { xs: "4px" } } }])
  }
}

const themeBootstrap = {
  themeDefinition: { sources: [ThemeSource] },
  dimensions: [{ name: "culture", values: ["en-US", "uk-UA"] }],
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve))

const definitionLoadersOf = (app: Application): readonly unknown[] =>
  (app as unknown as { clearables: readonly unknown[] }).clearables.filter(
    (clearable) => clearable instanceof DefinitionLoader,
  )

describe("application without component, dictionary and config definitions", () => {
  beforeEach(() => {
    calls.start = 0
    calls.stop = 0
    calls.rootHost = 0
    calls.tokens = 0
  })

  it("then constructs, so the three definition sections are optional", () => {
    expect(() => new TestApplication()).not.toThrow()
  })

  it("then builds no definition providers, so it has no components, no dictionaries and no configs", () => {
    expect(definitionLoadersOf(new TestApplication())).toEqual([])
  })

  it("then builds one provider per bootstrapped section, so only what is asked for exists", () => {
    const app = new TestApplication({
      componentDefinition: { sources: [] },
      dictionaryDefinition: { sources: [] },
      configDefinition: { sources: [] },
    })

    expect(definitionLoadersOf(app).length).toBe(3)
  })

  it("then resolves a config or dictionary binding to undefined rather than demanding a definition", async () => {
    const evaluator = new BindingEvaluator(new ConverterProvider(new Map(), () => ({}) as never), [
      new StateValueSource(new StateManager()),
      new LiteralValueSource(),
    ])

    const config: IBindingExpression = { type: "config", value: "Sizes.width" }
    const dictionary: IBindingExpression = { type: "dictionary", value: "Labels.hello" }

    expect(await evaluator.resolve(config, "App")).toBeUndefined()
    expect(await evaluator.resolve(dictionary, "App")).toBeUndefined()
  })

  it("then starts without resolving a root host, so an application without UI runs", async () => {
    const app = new TestApplication()

    await app.start()

    expect(calls.start).toBe(1)
    expect(calls.rootHost).toBe(0)

    app.stop()

    expect(calls.stop).toBe(1)
  })

  it("then resolves a root host once component definitions are bootstrapped, so a missing host stays an error", async () => {
    const app = new TestApplication({ componentDefinition: { sources: [] } })

    await expectAsync(app.start()).toBeRejected()

    expect(calls.rootHost).toBe(1)
  })

  it("then re-applies the theme on a dimension change while it runs", async () => {
    const app = new TestApplication(themeBootstrap)

    await app.start()

    expect(calls.tokens).toBe(1)

    app.switchDimension({ culture: "en-US" })

    await settle()

    expect(calls.tokens).toBe(2)

    app.stop()
  })

  it("then leaves the theme alone on a dimension change while stopped, so nothing is published into a host it no longer owns", async () => {
    const app = new TestApplication(themeBootstrap)

    await app.start()

    app.stop()

    app.switchDimension({ culture: "en-US" })

    await settle()

    expect(calls.tokens).toBe(1)
  })
})
