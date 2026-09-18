import type { IComponentContext, IComponentDriver, PlatformComponent } from "@heleonix/hx-core"
import { WebAppHost } from "./WebAppHost"
import { WebPlatformComponent } from "./WebPlatformComponent"

export class WebComponentDriver implements IComponentDriver {
  private readonly host: WebAppHost

  public constructor(host: WebAppHost) {
    this.host = host
  }

  public getRootHost(selector: string, context: IComponentContext): PlatformComponent | null {
    const element = document.querySelector<HTMLElement>(selector)

    if (!element) {
      return null
    }

    this.host.setRoot(element)

    const host = new WebPlatformComponent(context)

    host.adoptNative(element)

    return host
  }
}
