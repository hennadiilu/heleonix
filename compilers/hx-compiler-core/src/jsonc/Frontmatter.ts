import { FRONTMATTER_FENCE, FRONTMATTER_OPEN_PATTERN } from "@heleonix/hx-language"
import { Errors } from "../errors/Errors"
import { HeleonixCompilerError } from "../errors/HeleonixCompilerError"
import type { IFrontmatterDocument } from "./IFrontmatterDocument"
import type { IHeaderBlock } from "./IHeaderBlock"

// Leading fence line, lazily captured header, closing fence line. JS `\s`
// includes a leading BOM (U+FEFF), so it is tolerated implicitly.
const FRONTMATTER_PATTERN = new RegExp(
  `${FRONTMATTER_OPEN_PATTERN}([\\s\\S]*?)(?:\\r?\\n)?${FRONTMATTER_FENCE}[ \\t]*(?:\\r?\\n|$)`,
)
const OPENS_FRONTMATTER = new RegExp(FRONTMATTER_OPEN_PATTERN)

/**
 * Splits a Heleonix source into an optional frontmatter header and the
 * document body. The header uses the CSS-like dialect shared by every format:
 *
 * ```text
 * ---
 * usage: extend
 * /** Detached (blank line below): the file-level summary. *\/
 *
 * props: { variant?: 'primary' | 'secondary' }
 * ---
 * { ...body... }
 * ```
 *
 * Comments are `// line` and `/* block *\/`. A `/** *\/` doc comment followed
 * by a blank line is detached - the file summary; one directly above an entry
 * documents it. Top-level lines are scalar `key: value` facts; the typing keys
 * `props:` / `events:` / `params:` capture opaque TypeScript type text (a name
 * or a brace-balanced literal) handed to the compiler unparsed. Values are raw
 * text - no unquoting.
 */
export function splitFrontmatter(source: string): IFrontmatterDocument {
  const match = FRONTMATTER_PATTERN.exec(source)

  if (!match) {
    if (OPENS_FRONTMATTER.test(source)) {
      throw new HeleonixCompilerError(Errors.frontmatterUnterminated)
    }

    return { frontmatter: {}, body: source }
  }

  const document = parseHeader(match[1])

  document.body = source.slice(match[0].length)

  return document
}

const DETACHED = /^[ \t]*\r?\n[ \t]*(\r?\n|$)/

// Keys whose value is opaque TypeScript type text captured verbatim (a type
// name or an inline `{ … }` literal), never parsed by the DSL.
const TYPE_KEY = /^(props|events|params)[ \t]*:/

/**
 * Parses header-dialect text without fences - the grammar of frontmatter
 * headers, for header-only parsing.
 * The returned `body` is always empty.
 */
export function parseHeader(header: string): IFrontmatterDocument {
  const result: IFrontmatterDocument = { frontmatter: {}, body: "" }

  let block: IHeaderBlock | undefined
  let pendingDocs: string | undefined
  let i = 0

  while (i < header.length) {
    const ch = header.charAt(i)

    if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
      i += 1

      continue
    }

    if (header.startsWith("//", i)) {
      i = skipToLineEnd(header, i)

      continue
    }

    if (header.startsWith("/*", i)) {
      const end = header.indexOf("*/", i + 2)

      if (end === -1) {
        throw new HeleonixCompilerError(Errors.frontmatterInvalidEntry, header.slice(i, skipToLineEnd(header, i)))
      }

      const inner = header.slice(i + 2, end)

      i = end + 2

      if (inner.startsWith("*")) {
        if (DETACHED.test(header.slice(i))) {
          if (result.docs === undefined) {
            result.docs = inner
          }

          pendingDocs = undefined
        } else {
          pendingDocs = inner
        }
      }

      continue
    }

    if (ch === "}") {
      if (!block) {
        throw new HeleonixCompilerError(Errors.frontmatterInvalidEntry, "}")
      }

      block = undefined
      pendingDocs = undefined
      i += 1

      continue
    }

    const typeKey = block ? null : TYPE_KEY.exec(header.slice(i))

    if (typeKey) {
      const key = typeKey[1]
      const captured = captureTypeValue(header, i + typeKey[0].length)

      if (!captured.value) {
        throw new HeleonixCompilerError(Errors.frontmatterInvalidEntry, `${key}:`)
      }

      ;(result.types ??= {})[key] = captured.value

      if (pendingDocs) {
        ;(result.frontmatterDocs ??= {})[key] = pendingDocs
      }

      pendingDocs = undefined
      i = captured.end

      continue
    }

    const lineEnd = skipToLineEnd(header, i)
    const line = stripTrailingComment(header.slice(i, lineEnd)).trim()

    i = lineEnd

    if (line.endsWith("{") && !line.slice(0, -1).includes(":")) {
      const name = line.slice(0, -1).trim()

      if (!name) {
        throw new HeleonixCompilerError(Errors.frontmatterInvalidEntry, line)
      }

      if (block) {
        throw new HeleonixCompilerError(Errors.frontmatterBlockNested, name)
      }

      block = { entries: {} }

      if (pendingDocs) {
        block.docs = pendingDocs
      }

      const blocks = (result.blocks ??= {})

      blocks[name] = block

      pendingDocs = undefined

      continue
    }

    const colon = line.indexOf(":")

    if (colon <= 0) {
      throw new HeleonixCompilerError(Errors.frontmatterInvalidEntry, line)
    }

    const key = line.slice(0, colon).trim()
    const value = line.slice(colon + 1).trim()

    if (block) {
      block.entries[key] = pendingDocs ? { value, docs: pendingDocs } : { value }
    } else {
      result.frontmatter[key] = value

      if (pendingDocs) {
        ;(result.frontmatterDocs ??= {})[key] = pendingDocs
      }
    }

    pendingDocs = undefined
  }

  if (block) {
    throw new HeleonixCompilerError(Errors.frontmatterBlockUnterminated)
  }

  return result
}

function skipToLineEnd(text: string, from: number): number {
  const lineEnd = text.indexOf("\n", from)

  return lineEnd === -1 ? text.length : lineEnd
}

/**
 * Captures an opaque TypeScript type value starting at `from`: a type name or
 * an inline `{ … }` literal. The value spans newlines only while inside
 * unbalanced braces; a newline at brace depth 0 ends it. String and comment
 * spans are tracked so their braces and newlines never miscount. The DSL does
 * not interpret the captured text - it is handed to the TypeScript compiler.
 */
function captureTypeValue(text: string, from: number): { value: string; end: number } {
  let i = from
  let depth = 0

  while (i < text.length && (text.charAt(i) === " " || text.charAt(i) === "\t")) {
    i += 1
  }

  const start = i

  while (i < text.length) {
    const ch = text.charAt(i)

    if (ch === "\n" && depth === 0) {
      break
    }

    if (ch === "'" || ch === '"' || ch === "`") {
      i = skipString(text, i, ch)

      continue
    }

    if (ch === "/" && text.charAt(i + 1) === "/") {
      i = skipToLineEnd(text, i)

      continue
    }

    if (ch === "/" && text.charAt(i + 1) === "*") {
      const end = text.indexOf("*/", i + 2)

      i = end === -1 ? text.length : end + 2

      continue
    }

    if (ch === "{") {
      depth += 1
    } else if (ch === "}" && depth > 0) {
      depth -= 1
    }

    i += 1
  }

  return { value: text.slice(start, i).trim(), end: i }
}

/** Index just past the closing `quote`, tolerating `\`-escapes. */
function skipString(text: string, from: number, quote: string): number {
  let i = from + 1

  while (i < text.length) {
    const ch = text.charAt(i)

    if (ch === "\\") {
      i += 2

      continue
    }

    if (ch === quote) {
      return i + 1
    }

    i += 1
  }

  return i
}

/** Cuts a trailing `//` or `/*` comment start outside single quotes. */
function stripTrailingComment(line: string): string {
  let quoted = false

  for (let i = 0; i < line.length - 1; i++) {
    const ch = line.charAt(i)

    if (ch === "'") {
      quoted = !quoted
    } else if (!quoted && ch === "/" && (line.charAt(i + 1) === "/" || line.charAt(i + 1) === "*")) {
      return line.slice(0, i)
    }
  }

  return line
}
