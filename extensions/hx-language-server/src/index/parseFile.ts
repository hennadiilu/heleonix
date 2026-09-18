import path from "node:path"
import { IJsoncComment, IJsoncEntry, IXmlScan, parseJsonc, scanXml, splitFrontmatter } from "@heleonix/hx-compiler-core"
import { EXT_CONFIG, EXT_DICTIONARY, EXT_TEMPLATE } from "@heleonix/hx-language"

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

  return { kind: "other" }
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
