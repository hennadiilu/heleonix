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

/**
 * Everything one Heleonix source kind contributes to the editor. The server's
 * {@link LanguageRouter} dispatches per document extension; adding a new kind
 * means implementing this and registering it - the server stays kind-agnostic.
 */
export interface ILanguageService {
  readonly kind: Kind

  /** File extension this service handles, e.g. `.hxm` (from `@heleonix/hx-language`). */
  readonly extension: string

  readonly completionTriggerCharacters?: readonly string[]

  readonly semanticTokensLegend?: SemanticTokensLegend

  diagnostics(doc: TextDocument, context: ILanguageContext): Diagnostic[]

  completion?(doc: TextDocument, position: Position, context: ILanguageContext): CompletionItem[]

  hover?(doc: TextDocument, position: Position, context: ILanguageContext): Hover | null

  /** Go-to-definition the service resolves itself (e.g. a converter/action to its class), or null to fall back. */
  definition?(doc: TextDocument, position: Position, context: ILanguageContext): Location | null

  semanticTokens?(doc: TextDocument): SemanticTokens

  /** Called when a document closes, so the service can drop per-document caches. */
  onClose?(uri: string): void
}
