import type { Component } from "./components/Component"
import type { IScheduler } from "./platform/IScheduler"
import type { IDimensionManager } from "./dimension/IDimensionManager"
import type { IComponentContext } from "./components/IComponentContext"
import type { IComponentManager } from "./components/IComponentManager"
import type { IState } from "./state/IState"
import type { IDictionaryProvider } from "./dictionaries/IDictionaryProvider"
import type { IConfigProvider } from "./configs/IConfigProvider"
import type { IActionProvider } from "./actions/IActionProvider"
import type { IServiceProvider } from "./services/IServiceProvider"
import type { ApplicationRuntime } from "./platform/ApplicationRuntime"
import type { PlatformComponent } from "./components/PlatformComponent"
import type { IApplicationBootstrap } from "./IApplicationBootstrap"
import type { IClearable } from "./common/IClearable"
import type { ThemeManager } from "./theming/ThemeManager"
import type { StyleManager } from "./styling/StyleManager"
import { HeleonixError } from "./errors/HeleonixError"
import { Errors } from "./errors/Errors"
import { composeApplication } from "./composition/composeApplication"

export abstract class Application {
  protected readonly scheduler: IScheduler

  protected readonly dimensions: IDimensionManager

  protected readonly state: IState

  protected readonly configs: IConfigProvider

  protected readonly dictionaries: IDictionaryProvider

  protected readonly actions: IActionProvider

  protected readonly services: IServiceProvider

  private readonly componentContext: IComponentContext

  private readonly runtime: ApplicationRuntime

  private readonly components: IComponentManager

  private _rootComponent: Component | undefined

  private readonly clearables: readonly IClearable[]

  private readonly isHeadless: boolean

  private isStarted = false

  private readonly themes: ThemeManager | undefined

  private readonly styles: StyleManager | undefined

  public constructor(
    protected readonly name: string,
    bootstrap: IApplicationBootstrap,
  ) {
    const graph = composeApplication(bootstrap)

    this.runtime = graph.runtime
    this.scheduler = graph.scheduler
    this.dimensions = graph.dimensions
    this.state = graph.state
    this.configs = graph.configs
    this.dictionaries = graph.dictionaries
    this.actions = graph.actions
    this.services = graph.services
    this.components = graph.components
    this.componentContext = graph.componentContext
    this.themes = graph.themes
    this.styles = graph.styles
    this.isHeadless = graph.isHeadless
    this.clearables = graph.clearables
  }

  protected get rootSelector(): string {
    return "body"
  }

  protected get rootComponent(): Component | undefined {
    return this._rootComponent
  }

  public async start(): Promise<void> {
    if (this.isStarted) {
      throw new HeleonixError(Errors.applicationLifecycle, "start", "the application is already started")
    }

    try {
      this.isStarted = true

      this.dimensions.changed.on(this.handleDimensionChange)

      this.runtime.start()

      const rootHost = this.isHeadless ? undefined : this.resolveRootHost()

      await this.themes?.apply()

      if (rootHost) {
        const rootUsage = {
          tag: this.name,
          name: this.name,
        }

        this._rootComponent = await this.components.build(rootUsage, undefined, undefined, rootHost)
      }
    } catch (e) {
      this.stop()

      if (e instanceof HeleonixError) {
        throw e
      }

      throw new HeleonixError(Errors.applicationLifecycle, "start", String(e))
    }
  }

  public stop(): void {
    if (!this.isStarted) {
      return
    }

    try {
      this.isStarted = false

      this.dimensions.changed.off(this.handleDimensionChange)

      if (this._rootComponent) {
        this.components.destroy(this._rootComponent)

        this._rootComponent = undefined
      }

      for (const clearable of this.clearables) {
        clearable.clear()
      }

      this.runtime.stop()
    } catch (e) {
      if (e instanceof HeleonixError) {
        throw e
      }

      throw new HeleonixError(Errors.applicationLifecycle, "stop", String(e))
    }
  }

  private resolveRootHost(): PlatformComponent {
    const rootHost = this.runtime.componentDriver.getRootHost(this.rootSelector, this.componentContext)

    if (!rootHost) {
      throw new HeleonixError(Errors.noRootElement, this.rootSelector)
    }

    return rootHost
  }

  private readonly handleDimensionChange = (): void => {
    void this.themes?.apply()

    void this.styles?.reapply()

    if (this._rootComponent) {
      this.scheduler.scheduleCompute(this.reconcileRootJob)
    }
  }

  private readonly reconcileRootJob = (): void => {
    void this.reconcileRoot()
  }

  private readonly reconcileRoot = async (): Promise<void> => {
    if (!this._rootComponent) {
      return
    }

    await this._rootComponent.update(this._rootComponent.definition, this._rootComponent.usage)
  }
}
