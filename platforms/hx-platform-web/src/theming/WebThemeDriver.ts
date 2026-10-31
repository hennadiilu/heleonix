import type { IThemeDriver } from "@heleonix/hx-core"
import type { IThemeDefinition } from "@heleonix/hx-language"
import { WebAppHost } from "../host/WebAppHost"
import type { StyleSheetElement } from "../host/StyleSheetElement"
import { composeThemeArtifacts } from "./composeThemeArtifacts"
import { interpolateValue } from "../styling/interpolateValue"

export class WebThemeDriver implements IThemeDriver {
  private artifactSheet: StyleSheetElement | undefined

  private readonly host: WebAppHost

  public constructor(host: WebAppHost) {
    this.host = host
  }

  // An alias publishes as a `var()` chain to the token it names, not as that
  // token's value, so DevTools shows the chain and an overlay swaps one link.
  public applyTokens(tokens: ReadonlyMap<string, string>): void {
    for (const [name, value] of tokens) {
      this.host.publishVariable(`--${name}`, interpolateValue(value))
    }
  }

  public applyArtifacts(theme: IThemeDefinition): void {
    this.artifactSheet ??= this.host.createSheet()

    this.artifactSheet.textContent = composeThemeArtifacts(theme)
  }

  public clear(): void {
    this.artifactSheet = undefined
  }
}
