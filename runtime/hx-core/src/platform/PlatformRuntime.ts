import { FrameworkElement } from "../FrameworkElement"
import { StateManager } from "../state/StateManager"
import { ComponentManager } from "../components/ComponentManager"
import { DimensionManager } from "../dimension/DimensionManager"
import { DictionaryProvider } from "../dictionaries/DictionaryProvider"
import { ConfigProvider } from "../configs/ConfigProvider"

export abstract class PlatformRuntime extends FrameworkElement<
  StateManager | ComponentManager | DimensionManager | DictionaryProvider | ConfigProvider
> {
  public static get diName(): string {
    return "PlatformRuntime"
  }

  public abstract start(): void

  public abstract stop(): void
}
