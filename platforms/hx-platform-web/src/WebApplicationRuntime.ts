import { ApplicationRuntime } from "@heleonix/hx-core"
import type { IComponentDefinition } from "@heleonix/hx-language"
import type {
  ComponentConstructor,
  DefinitionSource,
  IComponentDriver,
  IScheduler,
  IStyleDriver,
  IThemeDriver,
} from "@heleonix/hx-core"
import { WebAppHost } from "./WebAppHost"
import { WebComponentDefinitionSource } from "./WebComponentDefinitionSource"
import { WebComponentDriver } from "./WebComponentDriver"
import { WebPlatformComponent } from "./WebPlatformComponent"
import { WebScheduler } from "./WebScheduler"
import { WebThemeDriver } from "./WebThemeDriver"
import { DomStyleSheet } from "./styling/DomStyleSheet"
import { RefcountedStyleSheet } from "./styling/RefcountedStyleSheet"
import { WebStyleDriver } from "./styling/WebStyleDriver"

export class WebApplicationRuntime extends ApplicationRuntime {
  private readonly host = new WebAppHost()

  private readonly webComponentDriver = new WebComponentDriver(this.host)

  private readonly webThemeDriver = new WebThemeDriver(this.host)

  private readonly webScheduler = new WebScheduler()

  private webStyleDriver: WebStyleDriver | undefined

  public get componentDriver(): IComponentDriver {
    return this.webComponentDriver
  }

  public get themeDriver(): IThemeDriver {
    return this.webThemeDriver
  }

  public get scheduler(): IScheduler {
    return this.webScheduler
  }

  public get styleDriver(): IStyleDriver {
    // Style writes flush through the application's commit phase, so they land in
    // the same frame as the component property writes they belong with.
    this.webStyleDriver ??= new WebStyleDriver(
      new RefcountedStyleSheet(new DomStyleSheet(this.host.createSheet())),
      (component) => (component as unknown as WebPlatformComponent).roots,
      this.webScheduler,
    )

    return this.webStyleDriver
  }

  public override get componentConstructors(): readonly ComponentConstructor[] {
    return [WebPlatformComponent]
  }

  public override get componentDefinitionSources(): readonly DefinitionSource<IComponentDefinition>[] {
    return [new WebComponentDefinitionSource()]
  }

  public stop(): void {
    // Before the host goes: a queued job would otherwise flush into DOM this
    // runtime no longer owns, or into the next run's frame after a restart.
    this.webScheduler.clear()

    this.webThemeDriver.clear()

    this.host.clear()

    this.webStyleDriver = undefined
  }
}
