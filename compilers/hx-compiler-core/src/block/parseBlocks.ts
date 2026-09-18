import type { IBlock } from "./IBlock"
import type { IBlockDocument } from "./IBlockDocument"
import type { IBlockNode } from "./IBlockNode"

const INTERPOLATION_PREFIXES = "$@#"

export function parseBlocks(source: string): IBlockDocument {
  const src = source
  const len = src.length
  let pos = 0

  return { nodes: parseNodes(false) }

  function parseNodes(nested: boolean): IBlockNode[] {
    const nodes: IBlockNode[] = []

    for (;;) {
      const doc = skipTrivia()

      if (pos >= len) {
        break
      }

      if (src.charAt(pos) === "}") {
        pos++

        if (nested) {
          break
        }

        continue
      }

      const node = parseNode()

      if (node) {
        if (doc !== undefined) {
          node.doc = doc
        }

        nodes.push(node)
      }
    }

    return nodes
  }

  function parseNode(): IBlockNode | undefined {
    let buffer = ""
    let parenDepth = 0
    let colonIndex = -1

    while (pos < len) {
      const ch = src.charAt(pos)

      if (ch === '"' || ch === "'") {
        buffer += consumeString()
        continue
      }

      if (parenDepth === 0 && ch === "/" && (src.charAt(pos + 1) === "*" || src.charAt(pos + 1) === "/")) {
        skipComment()
        continue
      }

      if (ch === "(") {
        parenDepth++
        buffer += ch
        pos++
        continue
      }

      if (ch === ")") {
        if (parenDepth > 0) {
          parenDepth--
        }

        buffer += ch
        pos++
        continue
      }

      if (ch === "{") {
        if (parenDepth > 0 || colonIndex >= 0 || isInterpolationAhead()) {
          buffer += consumeInterpolation()
          continue
        }

        pos++

        const block: IBlock = { kind: "block", prelude: buffer.trim(), nodes: parseNodes(true) }

        return block
      }

      if (ch === "}" && parenDepth === 0) {
        break
      }

      if (ch === ";" && parenDepth === 0) {
        pos++

        return makeNode(buffer, colonIndex)
      }

      if (ch === ":" && parenDepth === 0 && colonIndex < 0) {
        const head = buffer.trimStart()
        const first = head.charAt(0)

        if (head !== "" && first !== ":" && first !== "@") {
          colonIndex = buffer.length
        }
      }

      buffer += ch
      pos++
    }

    return makeNode(buffer, colonIndex)
  }

  function makeNode(buffer: string, colonIndex: number): IBlockNode | undefined {
    if (colonIndex >= 0) {
      return {
        kind: "declaration",
        name: buffer.slice(0, colonIndex).trim(),
        value: buffer.slice(colonIndex + 1).trim(),
      }
    }

    const text = buffer.trim()

    return text === "" ? undefined : { kind: "statement", text }
  }

  function isInterpolationAhead(): boolean {
    return INTERPOLATION_PREFIXES.indexOf(src.charAt(pos + 1)) >= 0
  }

  function consumeInterpolation(): string {
    let out = ""
    let depth = 0
    let quote = ""

    while (pos < len) {
      const ch = src.charAt(pos)
      out += ch
      pos++

      if (quote) {
        if (ch === quote) {
          quote = ""
        }
      } else if (ch === "'" || ch === '"') {
        quote = ch
      } else if (ch === "{") {
        depth++
      } else if (ch === "}") {
        depth--

        if (depth === 0) {
          break
        }
      }
    }

    return out
  }

  function consumeString(): string {
    const quote = src.charAt(pos)
    let out = quote
    pos++

    while (pos < len) {
      const ch = src.charAt(pos)
      out += ch
      pos++

      if (ch === "\\" && pos < len) {
        out += src.charAt(pos)
        pos++
        continue
      }

      if (ch === quote) {
        break
      }
    }

    return out
  }

  function skipComment(): void {
    if (src.charAt(pos + 1) === "*") {
      pos += 2

      while (pos < len && !(src.charAt(pos) === "*" && src.charAt(pos + 1) === "/")) {
        pos++
      }

      pos = Math.min(pos + 2, len)
    } else {
      pos += 2

      while (pos < len && src.charAt(pos) !== "\n" && src.charAt(pos) !== "\r") {
        pos++
      }
    }
  }

  function skipTrivia(): string | undefined {
    let doc: string | undefined

    for (;;) {
      const ch = src.charAt(pos)

      if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f") {
        pos++
      } else if (ch === "/" && src.charAt(pos + 1) === "*") {
        const start = pos
        const isDoc = src.charAt(pos + 2) === "*"

        skipComment()

        if (isDoc) {
          doc = src.slice(start, pos)
        }
      } else if (ch === "/" && src.charAt(pos + 1) === "/") {
        skipComment()
      } else {
        break
      }
    }

    return doc
  }
}
