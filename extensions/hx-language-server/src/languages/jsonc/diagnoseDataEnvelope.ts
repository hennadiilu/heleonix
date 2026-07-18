import { JsoncParser, splitFrontmatter, HeleonixCompilerError } from "@heleonix/hx-compiler-core"
import { USAGE_KEY, USAGE_VALUES } from "@heleonix/hx-language"
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { makeDiagnostic } from "../../lsp/makeDiagnostic"
import { IDataEnvelope } from "./IDataEnvelope"
import { CONFIG_MESSAGES } from "../config/configMessages"

const VALID_USAGE = new Set<string>(USAGE_VALUES)
const USAGE_ENTRY = new RegExp(`${USAGE_KEY}[ \\t]*:[ \\t]*(\\S+)`)

/**
 * Produces the diagnostics shared by all data formats - malformed frontmatter,
 * an unknown `usage` value, and JSONC syntax errors - and returns the parsed
 * body so kind-specific checks (e.g. dictionary flatness) can run.
 */
export function diagnoseDataEnvelope(doc: TextDocument): IDataEnvelope {
  const text = doc.getText()
  const diagnostics: Diagnostic[] = []

  let body: string
  let frontmatter: Record<string, string>

  try {
    const split = splitFrontmatter(text)
    body = split.body
    frontmatter = split.frontmatter
  } catch (e) {
    diagnostics.push(fromCompilerError(doc, e, 0))
    return { diagnostics, bodyStart: 0, parseOk: false }
  }

  const usage = frontmatter[USAGE_KEY]

  if (usage !== undefined && !VALID_USAGE.has(usage)) {
    const match = USAGE_ENTRY.exec(text.slice(0, text.length - body.length))

    if (match) {
      const at = match.index + match[0].indexOf(match[1])
      diagnostics.push(
        makeDiagnostic(doc, at, at + match[1].length, CONFIG_MESSAGES.unknownUsage(usage), DiagnosticSeverity.Warning),
      )
    }
  }

  const bodyStart = text.length - body.length
  let parseOk = true

  try {
    new JsoncParser().parse(body)
  } catch (e) {
    parseOk = false
    diagnostics.push(fromCompilerError(doc, e, bodyStart))
  }

  return { diagnostics, body, bodyStart, parseOk }
}

function fromCompilerError(doc: TextDocument, e: unknown, base: number): Diagnostic {
  const message = e instanceof Error ? e.message : String(e)
  const offset = e instanceof HeleonixCompilerError && e.offset !== undefined ? base + e.offset : base
  const length = doc.getText().length
  const clamped = Math.min(offset, length)

  return makeDiagnostic(
    doc,
    clamped,
    Math.min(clamped + 1, length),
    message ?? CONFIG_MESSAGES.parseError,
    DiagnosticSeverity.Error,
  )
}
