import { FRONTMATTER_FENCE, FRONTMATTER_OPEN_PATTERN } from "@heleonix/hx-language"
import { Errors } from "../errors/Errors"
import { HeleonixCompilerError } from "../errors/HeleonixCompilerError"
import { IFrontmatterDocument } from "./IFrontmatterDocument"

// Leading fence line, lazily captured header, closing fence line. JS `\s`
// includes a leading BOM (U+FEFF), so it is tolerated implicitly.
const FRONTMATTER_PATTERN = new RegExp(
  `${FRONTMATTER_OPEN_PATTERN}([\\s\\S]*?)(?:\\r?\\n)?${FRONTMATTER_FENCE}[ \\t]*(?:\\r?\\n|$)`,
)
const OPENS_FRONTMATTER = new RegExp(FRONTMATTER_OPEN_PATTERN)

/**
 * Splits a Heleonix data source into an optional YAML-style frontmatter header
 * and the document body.
 *
 * A frontmatter block is a leading section delimited by lines containing only
 * `---`:
 *
 * ```text
 * ---
 * usage: override
 * ---
 * { ...body... }
 * ```
 *
 * Only flat `key: value` pairs are supported in the header (one per line);
 * blank lines and `#` comments are ignored. When no frontmatter is present the
 * whole source is returned as the body with an empty header.
 */
export function splitFrontmatter(source: string): IFrontmatterDocument {
  const match = FRONTMATTER_PATTERN.exec(source)

  if (!match) {
    if (OPENS_FRONTMATTER.test(source)) {
      throw new HeleonixCompilerError(Errors.frontmatterUnterminated)
    }

    return { frontmatter: {}, body: source }
  }

  return {
    frontmatter: parseHeader(match[1]),
    body: source.slice(match[0].length),
  }
}

function parseHeader(header: string): Record<string, string> {
  const result: Record<string, string> = {}

  for (const rawLine of header.split("\n")) {
    const line = rawLine.trim()

    if (line.length === 0 || line.charCodeAt(0) === 35 /* # */) {
      continue
    }

    const colon = line.indexOf(":")

    if (colon === -1) {
      throw new HeleonixCompilerError(Errors.frontmatterInvalidEntry, line)
    }

    const key = line.slice(0, colon).trim()

    if (key.length === 0) {
      throw new HeleonixCompilerError(Errors.frontmatterInvalidEntry, line)
    }

    result[key] = unquote(line.slice(colon + 1).trim())
  }

  return result
}

function unquote(value: string): string {
  const len = value.length

  if (len >= 2) {
    const first = value.charCodeAt(0)

    if ((first === 34 /* " */ || first === 39) /* ' */ && value.charCodeAt(len - 1) === first) {
      return value.slice(1, len - 1)
    }
  }

  return value
}
