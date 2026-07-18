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
  Position,
  SemanticTokens,
  SemanticTokensLegend,
} from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { ILanguageContext } from "../ILanguageContext"
import { ILanguageService } from "../ILanguageService"
import { completeComponent } from "./componentCompletion"
import { diagnoseComponent } from "./componentDiagnostics"
import { hoverComponent } from "./componentHover"
import { buildComponentSemanticTokens } from "./componentSemanticTokens"
import { XmlScanCache } from "../../xml/XmlScanCache"
import { LEGEND } from "./tokenLegend"

/** Language service for `*.hxm` component templates. */
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
    return completeComponent(doc, position, context.index, this.scanCache.get(doc))
  }

  public hover(doc: TextDocument, position: Position, context: ILanguageContext): Hover | null {
    return hoverComponent(doc, position, context.index, this.scanCache.get(doc))
  }

  public semanticTokens(doc: TextDocument): SemanticTokens {
    return buildComponentSemanticTokens(doc, this.scanCache.get(doc))
  }

  public onClose(uri: string): void {
    this.scanCache.delete(uri)
  }
}
