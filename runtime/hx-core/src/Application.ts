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
import { InjectableConstructor } from "./injection/InjectableConstructor"
import { StyleManager } from "./styling/StyleManager"
import { ThemeManager } from "./styling/ThemeManager"
import { StyleDefinitionProvider } from "./styling/StyleDefinitionProvider"
import { ThemeDefinitionProvider } from "./styling/ThemeDefinitionProvider"
import { IStyleDefinitionProviderSettings } from "./styling/IStyleDefinitionProviderSettings"
import { IThemeDefinitionProviderSettings } from "./styling/IThemeDefinitionProviderSettings"
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
  | StyleManager
  | ThemeManager
  // | Action | Converter | Service
> {
  protected readonly platformAdapter = this.inject(PlatformAdapter)

  protected readonly platformRuntime = this.inject(PlatformRuntime)

  protected readonly componentManager = this.inject(ComponentManager)

  protected readonly scheduler = this.inject(Scheduler)

  protected readonly dimensionManager = this.inject(DimensionManager)

  protected rootComponent: Component | undefined

  private readonly diContainerInstance: DIContainer

  private readonly styleConfigured: boolean

  private readonly themeConfigured: boolean

  public constructor(
    protected readonly name: string,
    bootstrap: IApplicationBootstrap,
  ) {
    const diContainer = new DIContainer()

    const styleConfigured = bootstrap.styleDefinition !== undefined
    const themeConfigured = bootstrap.themeDefinition !== undefined
    const stylingInjectables: InjectableConstructor[] = []

    if (styleConfigured || themeConfigured) {
      stylingInjectables.push(bootstrap.themeDefinition?.provider ?? ThemeDefinitionProvider)
      stylingInjectables.push(...(bootstrap.themeDefinition?.sources ?? []))
    }

    if (themeConfigured) {
      stylingInjectables.push(ThemeManager)
    }

    if (bootstrap.styleDefinition) {
      stylingInjectables.push(bootstrap.styleDefinition.provider ?? StyleDefinitionProvider)
      stylingInjectables.push(...bootstrap.styleDefinition.sources)
      stylingInjectables.push(StyleManager)
    }

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

      ...stylingInjectables,
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

    if (styleConfigured || themeConfigured) {
      diContainer.registerSettings<IThemeDefinitionProviderSettings>(
        (bootstrap.themeDefinition?.provider ?? ThemeDefinitionProvider).diName,
        { sources: bootstrap.themeDefinition?.sources ?? [] },
      )
    }

    if (bootstrap.styleDefinition) {
      diContainer.registerSettings<IStyleDefinitionProviderSettings>(
        (bootstrap.styleDefinition.provider ?? StyleDefinitionProvider).diName,
        {
          sources: bootstrap.styleDefinition.sources,
          selectionStrategy: bootstrap.styleDefinition.selectionStrategy,
        },
      )
    }

    super(diContainer)

    this.diContainerInstance = diContainer
    this.styleConfigured = styleConfigured
    this.themeConfigured = themeConfigured

    this.dimensionManager.dimensionChanged.on(this.handleDimensionChange)
  }

  protected get rootSelector(): string {
    return "body"
  }

  public async run(): Promise<void> {
    try {
      this.platformRuntime.start()

      // Establish the application's root host first, so the theme and style
      // back-ends anchor their platform state to it (the web appends its
      // `<style>` sheets under this root, not the shared document head) - keeping
      // multiple application instances on one page isolated.
      const rootHost = this.platformAdapter.getRootHost(this.rootSelector)

      if (!rootHost) {
        throw new HeleonixError(Errors.noRootElement, this.rootSelector)
      }

      if (this.themeConfigured) {
        await this.inject(ThemeManager).apply()
      }

      // Injecting the StyleManager activates its component-lifecycle
      // subscription, so every component built below (the root included) is styled.
      if (this.styleConfigured) {
        this.inject(StyleManager)
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
        this.platformAdapter.dispose()
        this.platformRuntime.stop()

        return
      }

      this.rootComponent.unmount()

      this.componentManager.destroyComponent(this.rootComponent)

      this.rootComponent = undefined

      this.platformAdapter.dispose()

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
