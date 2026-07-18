import { FrameworkElement } from "../FrameworkElement"
import type { PlatformComponent } from "../components/PlatformComponent"

export abstract class PlatformAdapter extends FrameworkElement<PlatformComponent> {
  public static get diName(): string {
    return "PlatformAdapter"
  }

  public abstract scheduleTask(callback: () => void): void

  public abstract getRootHost(selector: string): PlatformComponent | null
}
