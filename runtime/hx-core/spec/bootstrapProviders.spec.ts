import {
  Action,
  Application,
  ApplicationRuntime,
  HeleonixError,
  IfQualifier,
  Service,
  StyleQualifier,
} from "@heleonix/hx-core"
import { ServiceProvider } from "../src/services/ServiceProvider"
import type {
  IActionContext,
  IActionProvider,
  IApplicationBootstrap,
  IComponentDriver,
  IScheduler,
  IServiceContext,
  IServiceProvider,
  IStyleDriver,
  IStyleQualifierContext,
  StyleFragment,
} from "@heleonix/hx-core"
import type { QualifierProvider } from "../src/styling/qualifiers/QualifierProvider"
import type { IThemeDriver } from "@heleonix/hx-core"

class StubRuntime extends ApplicationRuntime {
  public get componentDriver(): IComponentDriver {
    return { getRootHost: () => null }
  }

  public get themeDriver(): IThemeDriver {
    return { applyTokens: () => {}, applyArtifacts: () => {} }
  }

  public get styleDriver(): IStyleDriver {
    return { compose: () => ({}) as never, release: () => {}, effectFor: () => ({}) as never }
  }

  public get scheduler(): IScheduler {
    return { scheduleCompute: () => {}, scheduleCommit: () => {} }
  }

  public stop(): void {}
}

class TestApplication extends Application {
  declare public readonly actions: IActionProvider

  declare public readonly services: IServiceProvider

  public constructor(bootstrap?: Omit<IApplicationBootstrap, "runtime">) {
    super("TestApplication", { ...bootstrap, runtime: StubRuntime })
  }

  public get qualifiers(): QualifierProvider | undefined {
    return (this as unknown as { styles?: { qualifiers: QualifierProvider } }).styles?.qualifiers
  }
}

class SessionService extends Service {
  public readonly id = Symbol("session")
}

class AuditService extends Service {
  public session(): SessionService {
    return this.context.services.get(SessionService)
  }
}

class SubmitAction extends Action {
  public static readonly hxName = "Submit"

  public readonly session: SessionService

  public constructor(context: IActionContext) {
    super(context)

    this.session = this.context.services.get(SessionService)
  }

  public Execute(): Promise<void> {
    return Promise.resolve()
  }
}

class OnRaisingQualifier extends StyleQualifier {
  public static readonly hxName = "OnRaising"

  public build(): StyleFragment {
    return { gate: "raised" }
  }
}

class MediaQualifier extends StyleQualifier {
  public static readonly hxName = "Media"

  public build(): StyleFragment {
    return { environment: "custom" }
  }
}

const styleBootstrap = { styleDefinition: { sources: [] }, themeDefinition: { sources: [] } }

describe("bootstrapped actions", () => {
  it("then resolves an action by the name its class declares", () => {
    const app = new TestApplication({ actions: [SubmitAction], services: [SessionService] })

    expect(app.actions.get("Submit")).toBeInstanceOf(SubmitAction)
  })

  it("then caches the instance, so an action is built once per run", () => {
    const app = new TestApplication({ actions: [SubmitAction], services: [SessionService] })

    expect(app.actions.get("Submit")).toBe(app.actions.get("Submit"))
  })

  it("then throws for an action that was not provided", () => {
    expect(() => new TestApplication().actions.get("Submit")).toThrowMatching(
      (e: Error) => (e as HeleonixError).code === "HX_CORE_0700",
    )
  })

  it("then throws when two actions claim the same name, so an undeclared subclass cannot shadow its base", () => {
    class AuditedSubmitAction extends SubmitAction {}

    expect(
      () => new TestApplication({ actions: [SubmitAction, AuditedSubmitAction], services: [SessionService] }),
    ).toThrowMatching((e: Error) => (e as HeleonixError).code === "HX_CORE_0002")
  })

  it("then hands the action the services it may resolve", () => {
    const app = new TestApplication({ actions: [SubmitAction], services: [SessionService] })

    expect((app.actions.get("Submit") as SubmitAction).session).toBe(app.services.get(SessionService))
  })
})

describe("bootstrapped services", () => {
  it("then resolves a provided service by its class, as a singleton", () => {
    const app = new TestApplication({ services: [SessionService] })

    expect(app.services.get(SessionService)).toBeInstanceOf(SessionService)
    expect(app.services.get(SessionService)).toBe(app.services.get(SessionService))
  })

  it("then lets a service resolve another service through its context", () => {
    const app = new TestApplication({ services: [SessionService, AuditService] })
    const audit = app.services.get(AuditService)

    expect(audit.session()).toBe(app.services.get(SessionService))
  })

  it("then throws for a service that was not provided", () => {
    const app = new TestApplication({ services: [AuditService] })
    const audit = app.services.get(AuditService)

    expect(() => audit.session()).toThrowMatching((e: Error) => (e as HeleonixError).code === "HX_CORE_0800")
  })

  it("then throws on a constructor cycle rather than recursing forever", () => {
    class LeftService extends Service {
      public constructor(context: IServiceContext) {
        super(context)

        this.context.services.get(RightService)
      }
    }

    class RightService extends Service {
      public constructor(context: IServiceContext) {
        super(context)

        this.context.services.get(LeftService)
      }
    }

    const services = new ServiceProvider(new Set([LeftService, RightService]))

    expect(() => services.get(LeftService)).toThrowMatching((e: Error) => (e as HeleonixError).code === "HX_CORE_0801")
  })
})

describe("bootstrapped style qualifiers", () => {
  it("then registers a custom qualifier under the name its class declares", () => {
    const app = new TestApplication({ ...styleBootstrap, qualifiers: [OnRaisingQualifier] })

    expect(app.qualifiers?.get("OnRaising")).toBeInstanceOf(OnRaisingQualifier)
  })

  it("then lets a custom qualifier replace a builtin of the same name", () => {
    const app = new TestApplication({ ...styleBootstrap, qualifiers: [MediaQualifier] })

    expect(app.qualifiers?.get("Media")).toBeInstanceOf(MediaQualifier)
  })

  it("then keeps the builtins that no custom qualifier claims", () => {
    const app = new TestApplication({ ...styleBootstrap, qualifiers: [OnRaisingQualifier] })

    expect(app.qualifiers?.get("If")).toBeInstanceOf(IfQualifier)
  })

  it("then hands the qualifier its context, so it reaches state", () => {
    let captured: IStyleQualifierContext | undefined

    class CapturingQualifier extends StyleQualifier {
      public static readonly hxName = "Capturing"

      public constructor(context: IStyleQualifierContext) {
        super(context)

        captured = context
      }
    }

    new TestApplication({ ...styleBootstrap, qualifiers: [CapturingQualifier] })

    expect(captured?.state).toBeDefined()
  })
})
