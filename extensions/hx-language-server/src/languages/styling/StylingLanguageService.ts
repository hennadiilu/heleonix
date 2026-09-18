import path from "node:path"
import { CompletionItem, Diagnostic, Hover, Location, Position } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { Kind } from "@heleonix/hx-language"
import { ILanguageContext } from "../ILanguageContext"
import { ILanguageService } from "../ILanguageService"
import { completeThemeToken, hoverThemeToken, definitionThemeToken } from "./themeTokenFeature"
import { completeQualifier, hoverQualifier } from "./qualifierFeature"

export class StylingLanguageService implements ILanguageService {
  public readonly kind: Kind

  public readonly extension: string

  public readonly completionTriggerCharacters = ["$", ".", "@", "("]

  public constructor(kind: Kind, extension: string) {
    this.kind = kind
    this.extension = extension
  }

  public diagnostics(): Diagnostic[] {
    return []
  }

  public completion(doc: TextDocument, position: Position, context: ILanguageContext): CompletionItem[] {
    const offset = doc.offsetAt(position)
    const component = path.basename(doc.uri).split(".")[0]

    return (
      completeThemeToken(doc, offset, context.themeTokens) ??
      completeQualifier(doc, offset, context.qualifiers, context.components, component, context.controlNames) ??
      []
    )
  }

  public hover(doc: TextDocument, position: Position, context: ILanguageContext): Hover | null {
    const offset = doc.offsetAt(position)

    return hoverThemeToken(doc, offset, context.themeTokens) ?? hoverQualifier(doc, offset, context.qualifiers)
  }

  public definition(doc: TextDocument, position: Position, context: ILanguageContext): Location | null {
    return definitionThemeToken(doc, doc.offsetAt(position), context.themeTokenLocations)
  }
}
