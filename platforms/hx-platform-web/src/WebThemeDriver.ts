import type { IThemeDriver } from "@heleonix/hx-core"
import type { IThemeDefinition } from "@heleonix/hx-language"
import { WebAppHost } from "./WebAppHost"
import type { StyleSheetElement } from "./styling/DomStyleSheet"
import { composeThemeArtifacts } from "./styling/composeThemeArtifacts"
import { mangleVariable } from "./styling/mangleVariable"

export class WebThemeDriver implements IThemeDriver {
  private artifactSheet: StyleSheetElement | undefined

  private readonly host: WebAppHost

  public constructor(host: WebAppHost) {
    this.host = host
  }

  public applyTokens(tokens: ReadonlyMap<string, string>): void {
    for (const [path, value] of tokens) {
      this.host.publishVariable(mangleVariable(path), value)
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
