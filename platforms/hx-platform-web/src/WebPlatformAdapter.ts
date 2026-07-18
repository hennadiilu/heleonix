import { PlatformAdapter, PlatformComponent } from "@heleonix/hx-core"
import { WebPlatformComponent } from "./WebPlatformComponent"

export class WebPlatformAdapter extends PlatformAdapter {
  public scheduleTask(callback: () => void): void {
    window.queueMicrotask(callback)
  }

  public getRootHost(selector: string): PlatformComponent | null {
    const element = document.querySelector<HTMLElement>(selector)

    if (!element) {
      return null
    }

    const host = this.inject(WebPlatformComponent)

    host.adoptNative(element)

    return host
  }
}
