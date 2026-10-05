import path from "node:path"
import { CompletionItem, Diagnostic, Hover, Location, Position } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import {
  CONFIG_REF_PREFIX,
  DICTIONARY_REF_PREFIX,
  Kind,
  PROPERTY_NAME_SEGMENT_SEPARATOR,
  THEME_REF_PREFIX,
} from "@heleonix/hx-language"
import { ILanguageContext } from "../ILanguageContext"
import { ILanguageService } from "../ILanguageService"
import { completeThemeToken, hoverThemeToken, definitionThemeToken } from "./themeTokenFeature"
import { completeQualifier, hoverQualifier } from "./qualifierFeature"
import { completeReference, hoverReference } from "./referenceFeature"
import { completeProperty } from "./propertyFeature"

export class StylingLanguageService implements ILanguageService {
  public readonly kind: Kind

  public readonly extension: string

  public readonly completionTriggerCharacters: readonly string[]

  // A style binds its component: its properties, dictionaries and configs. A
  // theme is static token data and resolves only `{$...}` aliases.
  private readonly bindsComponent: boolean

  public constructor(kind: Kind, extension: string) {
    this.kind = kind
    this.extension = extension
    this.bindsComponent = kind === "style"
    this.completionTriggerCharacters = [
      THEME_REF_PREFIX,
      PROPERTY_NAME_SEGMENT_SEPARATOR,
      "@",
      "(",
      ...(this.bindsComponent ? [DICTIONARY_REF_PREFIX, CONFIG_REF_PREFIX] : []),
    ]
  }

  public diagnostics(): Diagnostic[] {
    return []
  }

  public completion(doc: TextDocument, position: Position, context: ILanguageContext): CompletionItem[] {
    const offset = doc.offsetAt(position)
    const component = path.basename(doc.uri).split(".")[0]

    return (
      completeThemeToken(doc, offset, context.themeTokens) ??
      (this.bindsComponent ? completeReference(doc, offset, context.index) : undefined) ??
      (this.bindsComponent ? completeProperty(doc, offset, context.components, component) : undefined) ??
      completeQualifier(doc, offset, context.qualifiers, context.components, component, context.controlNames) ??
      []
    )
  }

  public hover(doc: TextDocument, position: Position, context: ILanguageContext): Hover | null {
    const offset = doc.offsetAt(position)

    return (
      hoverThemeToken(doc, offset, context.themeTokens) ??
      (this.bindsComponent ? hoverReference(doc, offset, context.index) : null) ??
      hoverQualifier(doc, offset, context.qualifiers)
    )
  }

  public definition(doc: TextDocument, position: Position, context: ILanguageContext): Location | null {
    return definitionThemeToken(doc, doc.offsetAt(position), context.themeTokenLocations)
  }
}
