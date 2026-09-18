import type { ComponentConstructor } from "../components/ComponentConstructor"
import type { IComponentDefinition } from "@heleonix/hx-language"
import type { DefinitionSource } from "../definitions/DefinitionSource"
import type { IScheduler } from "./IScheduler"
import type { IStyleDriver } from "./IStyleDriver"
import type { IComponentDriver } from "./IComponentDriver"
import type { IThemeDriver } from "./IThemeDriver"

const EMPTY_CONSTRUCTORS: readonly ComponentConstructor[] = Object.freeze([])

const EMPTY_SOURCES: readonly DefinitionSource<IComponentDefinition>[] = Object.freeze([])

export abstract class ApplicationRuntime {
  public get componentConstructors(): readonly ComponentConstructor[] {
    return EMPTY_CONSTRUCTORS
  }

  public get componentDefinitionSources(): readonly DefinitionSource<IComponentDefinition>[] {
    return EMPTY_SOURCES
  }

  public abstract get componentDriver(): IComponentDriver

  public abstract get themeDriver(): IThemeDriver

  public abstract get styleDriver(): IStyleDriver

  public abstract get scheduler(): IScheduler

  public start(): void {}

  public abstract stop(): void
}
