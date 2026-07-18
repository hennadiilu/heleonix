import { DIContainer } from "./injection/DIContainer"
import { Component } from "./components/Component"
import { ComponentManager } from "./components/ComponentManager"
import { ComponentDefinitionProvider } from "./components/ComponentDefinitionProvider"
import { FrameworkComponentDefinitionSource } from "./components/FrameworkComponentDefinitionSource"
import { DeclarativeComponent } from "./components/DeclarativeComponent"
import { Content } from "./components/Content"
import { Children } from "./components/Children"
import { Scheduler } from "./components/Scheduler"
import { StateManager } from "./state/StateManager"
import { DimensionManager } from "./dimension/DimensionManager"
import { DictionaryManager } from "./dictionaries/DictionaryManager"
import { DictionaryDefinitionProvider } from "./dictionaries/DictionaryDefinitionProvider"
import { ConfigManager } from "./configs/ConfigManager"
import { ConfigDefinitionProvider } from "./configs/ConfigDefinitionProvider"
import { PlatformAdapter } from "./platform/PlatformAdapter"
import { PlatformRuntime } from "./platform/PlatformRuntime"
import { HeleonixError } from "./errors/HeleonixError"
import { Errors } from "./errors/Errors"
import { FrameworkElement } from "./FrameworkElement"
import { DictionaryProvider } from "./dictionaries/DictionaryProvider"
import { ConfigProvider } from "./configs/ConfigProvider"
import { IApplicationBootstrap } from "./IApplicationBootstrap"
import { IDimensionManagerSettings } from "./dimension/IDimensionManagerSettings"
import { IComponentDefinitionProviderSettings } from "./components/IComponentDefinitionProviderSettings"
import { IConfigDefinitionProviderSettings } from "./configs/IConfigDefinitionProviderSettings"
import { IDictionaryDefinitionProviderSettings } from "./dictionaries/IDictionaryDefinitionProviderSettings"

export abstract class Application extends FrameworkElement<
  | DictionaryProvider
  | ConfigProvider
  | StateManager
  | DimensionManager
  | ComponentManager
  | PlatformAdapter
  | PlatformRuntime
  | Scheduler
  // | Action | Converter | Service
> {
  protected readonly platformAdapter = this.inject(PlatformAdapter)

  protected readonly platformRuntime = this.inject(PlatformRuntime)

  protected readonly componentManager = this.inject(ComponentManager)

  protected readonly scheduler = this.inject(Scheduler)

  protected readonly dimensionManager = this.inject(DimensionManager)

  protected rootComponent: Component | undefined

  private readonly diContainerInstance: DIContainer

  public constructor(
    protected readonly name: string,
    bootstrap: IApplicationBootstrap,
  ) {
    const diContainer = new DIContainer()

    diContainer.registerInjectables([
      //...bootstrap.actions,
      //...bootstrap.converters,
      //...bootstrap.services,

      ...(bootstrap.components ?? []),

      bootstrap.platform.adapter,
      bootstrap.platform.runtime,

      bootstrap.componentDefinition.provider ?? ComponentDefinitionProvider,
      bootstrap.configDefinition.provider ?? ConfigDefinitionProvider,
      bootstrap.dictionaryDefinition.provider ?? DictionaryDefinitionProvider,

      ...bootstrap.componentDefinition.sources,
      ...bootstrap.configDefinition.sources,
      ...bootstrap.dictionaryDefinition.sources,

      // Framework injectables are placed last to avoid overrides.
      Children,
      DeclarativeComponent,
      Content,
      FrameworkComponentDefinitionSource,
      StateManager,
      Scheduler,
      ComponentManager,
      DictionaryManager,
      DictionaryProvider,
      ConfigManager,
      ConfigProvider,
      DimensionManager,
    ])

    diContainer.registerSettings<IDimensionManagerSettings>(DimensionManager.diName, {
      dimensions: bootstrap.dimensions,
    })

    diContainer.registerSettings<IComponentDefinitionProviderSettings>(
      (bootstrap.componentDefinition.provider ?? ComponentDefinitionProvider).diName,
      {
        sources: bootstrap.componentDefinition.sources,
        selectionStrategy: bootstrap.componentDefinition.selectionStrategy,
      },
    )

    diContainer.registerSettings<IConfigDefinitionProviderSettings>(
      (bootstrap.configDefinition.provider ?? ConfigDefinitionProvider).diName,
      {
        sources: bootstrap.configDefinition.sources,
        selectionStrategy: bootstrap.configDefinition.selectionStrategy,
      },
    )

    diContainer.registerSettings<IDictionaryDefinitionProviderSettings>(
      (bootstrap.dictionaryDefinition.provider ?? DictionaryDefinitionProvider).diName,
      {
        sources: bootstrap.dictionaryDefinition.sources,
        selectionStrategy: bootstrap.dictionaryDefinition.selectionStrategy,
      },
    )

    super(diContainer)

    this.diContainerInstance = diContainer

    this.dimensionManager.dimensionChanged.on(this.handleDimensionChange)
  }

  protected get rootSelector(): string {
    return "body"
  }

  public async run(): Promise<void> {
    try {
      this.platformRuntime.start()

      const rootHost = this.platformAdapter.getRootHost(this.rootSelector)

      if (!rootHost) {
        throw new HeleonixError(Errors.noRootElement, this.rootSelector)
      }

      const rootUsage = {
        tag: this.constructor.name,
        name: this.name,
      }

      this.rootComponent = await this.componentManager.buildComponent(rootUsage, undefined, undefined, rootHost)

      this.rootComponent.mount()
    } catch (e) {
      this.platformRuntime.stop()

      if (e instanceof HeleonixError) {
        throw e
      }

      throw new HeleonixError(Errors.applicationLifecycle, "run", String(e))
    }
  }

  public stop(): void {
    try {
      if (!this.rootComponent) {
        this.platformRuntime.stop()

        return
      }

      this.rootComponent.unmount()

      this.componentManager.destroyComponent(this.rootComponent)

      this.rootComponent = undefined

      this.platformRuntime.stop()

      this.diContainerInstance.clear()
    } catch (e) {
      if (e instanceof HeleonixError) {
        throw e
      }

      throw new HeleonixError(Errors.applicationLifecycle, "stop", String(e))
    }
  }

  private readonly handleDimensionChange = (): void => {
    if (!this.rootComponent) {
      return
    }

    this.scheduler.scheduleCompute(this.reconcileRootJob)
  }

  private readonly reconcileRootJob = (): void => {
    void this.reconcileRoot()
  }

  private readonly reconcileRoot = async (): Promise<void> => {
    if (!this.rootComponent) {
      return
    }

    await this.rootComponent.update(this.rootComponent.definition, this.rootComponent.usage)
  }
}
