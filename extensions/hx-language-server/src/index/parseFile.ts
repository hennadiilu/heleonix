import path from "node:path"
import {
  IBlockNode,
  IJsoncComment,
  IJsoncEntry,
  IXmlScan,
  parseBlocks,
  parseJsonc,
  scanXml,
  splitFrontmatter,
} from "@heleonix/hx-compiler-core"
import { EXT_CONFIG, EXT_DICTIONARY, EXT_STYLE, EXT_TEMPLATE, EXT_THEME } from "@heleonix/hx-language"
import type { IInterpolationRef } from "../references/IInterpolationRef"
import type { IThemeReference } from "../references/IThemeReference"
import { scanStyleReferences } from "../references/scanStyleReferences"
import { scanThemeReferences } from "../references/scanThemeReferences"

export type IParsedFile =
  | { kind: "component"; scan: IXmlScan }
  | {
      kind: "dictionary"
      body: string
      bodyStart: number
      entries: readonly IJsoncEntry[]
      comments: readonly IJsoncComment[]
    }
  | {
      kind: "config"
      body: string
      bodyStart: number
      entries: readonly IJsoncEntry[]
      comments: readonly IJsoncComment[]
    }
  | { kind: "style"; references: readonly IInterpolationRef[]; themeReferences: readonly IThemeReference[] }
  | { kind: "theme"; bodyStart: number; nodes: readonly IBlockNode[]; themeReferences: readonly IThemeReference[] }
  | { kind: "other" }

export function parseFile(filePath: string, source: string): IParsedFile {
  const ext = path.extname(filePath)

  if (ext === EXT_TEMPLATE) {
    return { kind: "component", scan: scanXml(source) }
  }

  if (ext === EXT_DICTIONARY) {
    return { kind: "dictionary", ...parseData(source) }
  }

  if (ext === EXT_CONFIG) {
    return { kind: "config", ...parseData(source) }
  }

  if (ext === EXT_STYLE) {
    return { kind: "style", references: scanStyleReferences(source), themeReferences: scanThemeReferences(source) }
  }

  if (ext === EXT_THEME) {
    return { kind: "theme", ...parseTheme(source), themeReferences: scanThemeReferences(source) }
  }

  return { kind: "other" }
}

function parseTheme(source: string): { bodyStart: number; nodes: readonly IBlockNode[] } {
  let body: string

  try {
    body = splitFrontmatter(source).body
  } catch {
    return { bodyStart: 0, nodes: [] }
  }

  return { bodyStart: source.length - body.length, nodes: parseBlocks(body).nodes }
}

function parseData(source: string): {
  body: string
  bodyStart: number
  entries: readonly IJsoncEntry[]
  comments: readonly IJsoncComment[]
} {
  let body: string

  try {
    body = splitFrontmatter(source).body
  } catch {
    return { body: "", bodyStart: 0, entries: [], comments: [] }
  }

  const bodyStart = source.length - body.length

  try {
    const { entries, comments } = parseJsonc(body)
    return { body, bodyStart, entries, comments }
  } catch {
    return { body, bodyStart, entries: [], comments: [] }
  }
}
