import { DefinitionSource } from "@heleonix/hx-core"
import type { IComponentDefinition } from "@heleonix/hx-language"
import type { IDimension } from "@heleonix/hx-language"
import { WebPlatformComponent } from "./WebPlatformComponent"

export class WebComponentDefinitionSource extends DefinitionSource<IComponentDefinition> {
  private readonly webComponentNameRegex =
    /^(?:[a-z][a-z0-9]*|(?!(?:annotation-xml|color-profile|font-face|font-face-src|font-face-uri|font-face-format|font-face-name|missing-glyph)$)[a-z][0-9a-z._-]*-[0-9a-z._-]*)$/

  public loadDefinitions(name: string, dimension: IDimension): Promise<readonly IComponentDefinition[]> {
    if (this.isWebComponentName(name)) {
      return Promise.resolve([{ tag: name, dimension, type: WebPlatformComponent.hxName }])
    }

    return Promise.resolve([])
  }

  private isWebComponentName(name: string): boolean {
    return this.webComponentNameRegex.test(name)
  }
}
