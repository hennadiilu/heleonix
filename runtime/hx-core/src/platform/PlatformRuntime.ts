import { FrameworkElement } from "../FrameworkElement"
import { StateManager } from "../state/StateManager"
import { ComponentManager } from "../components/ComponentManager"
import { DimensionManager } from "../dimension/DimensionManager"
import { DictionaryManager } from "../dictionaries/DictionaryManager"
import { ConfigManager } from "../configs/ConfigManager"

export abstract class PlatformRuntime extends FrameworkElement<
  StateManager | ComponentManager | DimensionManager | DictionaryManager | ConfigManager
> {
  public static get diName(): string {
    return "PlatformRuntime"
  }

  public abstract start(): void

  public abstract stop(): void
}
