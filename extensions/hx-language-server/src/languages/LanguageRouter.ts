import { SemanticTokensLegend } from "vscode-languageserver"
import { ILanguageService } from "./ILanguageService"

export class LanguageRouter {
  private readonly byExtension = new Map<string, ILanguageService>()

  public constructor(services: readonly ILanguageService[]) {
    for (const service of services) {
      this.byExtension.set(service.extension, service)
    }
  }

  public forUri(uri: string): ILanguageService | undefined {
    return this.byExtension.get(extensionOf(uri))
  }

  public completionTriggerCharacters(): string[] {
    const characters = new Set<string>()

    for (const service of this.byExtension.values()) {
      for (const character of service.completionTriggerCharacters ?? []) {
        characters.add(character)
      }
    }

    return [...characters]
  }

  public semanticTokensLegend(): SemanticTokensLegend | undefined {
    for (const service of this.byExtension.values()) {
      if (service.semanticTokensLegend) {
        return service.semanticTokensLegend
      }
    }

    return undefined
  }

  public watchGlob(): string {
    const extensions = [...this.byExtension.keys()].map((ext) => ext.replace(/^\./, ""))
    return `**/*.{${extensions.join(",")}}`
  }
}

function extensionOf(uri: string): string {
  const dot = uri.lastIndexOf(".")
  return dot === -1 ? "" : uri.slice(dot).toLowerCase()
}
