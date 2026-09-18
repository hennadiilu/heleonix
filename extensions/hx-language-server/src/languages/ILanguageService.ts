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
import { Kind } from "@heleonix/hx-language"
import { ILanguageContext } from "./ILanguageContext"

export interface ILanguageService {
  readonly kind: Kind

  readonly extension: string

  readonly completionTriggerCharacters?: readonly string[]

  readonly semanticTokensLegend?: SemanticTokensLegend

  diagnostics(doc: TextDocument, context: ILanguageContext): Diagnostic[]

  completion?(doc: TextDocument, position: Position, context: ILanguageContext): CompletionItem[]

  hover?(doc: TextDocument, position: Position, context: ILanguageContext): Hover | null

  definition?(doc: TextDocument, position: Position, context: ILanguageContext): Location | null

  semanticTokens?(doc: TextDocument): SemanticTokens

  onClose?(uri: string): void
}
