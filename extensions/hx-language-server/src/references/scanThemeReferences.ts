import { THEME_REF_PREFIX } from "@heleonix/hx-language"
import type { IThemeReference } from "./IThemeReference"
import { blankComments } from "./blankComments"

// Theme names are declaration names, so a group applied as declarations may
// name its leaves as CSS properties (`font-family`).
const SEGMENT = "[A-Za-z_-][\\w-]*"
const PATH = `${SEGMENT}(?:\\.${SEGMENT})*`
const PREFIX = THEME_REF_PREFIX.replace(/[$^\\.*+?()[\]{}|]/g, "\\$&")

const TOKEN = `\\{\\s*(${PREFIX}${PATH})\\s*(?:\\|[^{}]*)?\\}`
const APPLY = `@hx-apply\\s*\\(\\s*token\\s*:\\s*(${PATH})\\s*\\)`

// Every `{$path}` binding source, plus the group an `@hx-apply(token: path)`
// expands. A `{$...}` span starts at its prefix, like `@`/`#` references.
export function scanThemeReferences(source: string): IThemeReference[] {
  const text = blankComments(source)
  const refs: IThemeReference[] = []
  const token = new RegExp(TOKEN, "g")
  const apply = new RegExp(APPLY, "g")
  let match: RegExpExecArray | null

  while ((match = token.exec(text)) !== null) {
    const start = match.index + match[0].indexOf(match[1])

    refs.push({ path: match[1].slice(THEME_REF_PREFIX.length), start, end: start + match[1].length })
  }

  while ((match = apply.exec(text)) !== null) {
    const start = match.index + match[0].lastIndexOf(match[1])

    refs.push({ path: match[1], start, end: start + match[1].length })
  }

  return refs.sort((a, b) => a.start - b.start)
}
