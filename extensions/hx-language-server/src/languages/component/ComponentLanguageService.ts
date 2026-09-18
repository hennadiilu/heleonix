import {
  CONFIG_REF_PREFIX,
  DICTIONARY_REF_PREFIX,
  EXT_TEMPLATE,
  Kind,
  PROPERTY_NAME_SEGMENT_SEPARATOR,
  COMPONENT_PROPERTY_SEPARATOR,
} from "@heleonix/hx-language"
import {
  CompletionItem,
  Diagnostic,
  Hover,
  Location,
  Position,
  SemanticTokens,
  SemanticTokensLegend,
} from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { ILanguageContext } from "../ILanguageContext"
import { ILanguageService } from "../ILanguageService"
import { completeComponent } from "./componentCompletion"
import { completeConverterAction, definitionConverterAction, hoverConverterAction } from "./converterActionFeature"
import { definitionComponent } from "./componentDefinition"
import { diagnoseComponent } from "./componentDiagnostics"
import { hoverComponent } from "./componentHover"
import { buildComponentSemanticTokens } from "./componentSemanticTokens"
import { XmlScanCache } from "../../xml/XmlScanCache"
import { LEGEND } from "./tokenLegend"

export class ComponentLanguageService implements ILanguageService {
  public readonly kind: Kind = "component"

  public readonly extension = EXT_TEMPLATE

  public readonly semanticTokensLegend: SemanticTokensLegend = LEGEND

  public readonly completionTriggerCharacters: readonly string[] = [
    "<",
    DICTIONARY_REF_PREFIX,
    CONFIG_REF_PREFIX,
    PROPERTY_NAME_SEGMENT_SEPARATOR,
    COMPONENT_PROPERTY_SEPARATOR,
  ]

  private readonly scanCache = new XmlScanCache()

  public diagnostics(doc: TextDocument, context: ILanguageContext): Diagnostic[] {
    return diagnoseComponent(doc, this.scanCache.get(doc), context.index, context.unknownReferenceSeverity)
  }

  public completion(doc: TextDocument, position: Position, context: ILanguageContext): CompletionItem[] {
    const scan = this.scanCache.get(doc)
    const registry = completeConverterAction(doc, doc.offsetAt(position), scan, context.converters, context.actions)

    return registry ?? completeComponent(doc, position, context.index, scan, context.components)
  }

  public hover(doc: TextDocument, position: Position, context: ILanguageContext): Hover | null {
    const scan = this.scanCache.get(doc)

    return (
      hoverConverterAction(doc, doc.offsetAt(position), scan, context.converters, context.actions) ??
      hoverComponent(doc, position, context.index, scan, context.components)
    )
  }

  public definition(doc: TextDocument, position: Position, context: ILanguageContext): Location | null {
    const offset = doc.offsetAt(position)
    const scan = this.scanCache.get(doc)

    return (
      definitionConverterAction(doc, offset, scan, context.converters, context.actions) ??
      definitionComponent(offset, scan, context.components)
    )
  }

  public semanticTokens(doc: TextDocument): SemanticTokens {
    return buildComponentSemanticTokens(doc, this.scanCache.get(doc))
  }

  public onClose(uri: string): void {
    this.scanCache.delete(uri)
  }
}
