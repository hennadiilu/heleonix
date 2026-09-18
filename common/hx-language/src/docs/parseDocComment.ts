import type { IDocs } from "./IDocs"

const TAG_NAMES = "prop|param|example|deprecated|see"
// `@tag` at the start of a (decoration-stripped) line opens a new block.
const TAG_LINE = new RegExp(`^@(${TAG_NAMES})(?:\\s+|$)`)
// A mid-line `@tag` opens a block too, so single-line doc comments can carry
// tags; the whitespace before it becomes a line break.
const INLINE_TAG = new RegExp(`(\\S)[ \\t]+(?=@(?:${TAG_NAMES})\\b)`, "g")
// Leading whitespace and a JSDoc-style `*` decoration; the `*` is consumed
// only when followed by whitespace/end, so markdown like `**bold**` survives.
const DECORATION = /^\s*(?:\*(?:[ \t]|$))?/

// A named tag's first line: the target name followed by optional text.
const NAMED_TAG = /^(\S+)\s*/

export function parseDocComment(inner: string): IDocs | undefined {
  if (!inner.startsWith("*")) {
    return undefined
  }

  const lines = inner.slice(1).replace(INLINE_TAG, "$1\n").split(/\r?\n/)

  for (let i = 0; i < lines.length; i++) {
    lines[i] = lines[i].replace(DECORATION, "")
  }

  const docs: IDocs = {}
  let tag = ""
  let name = ""
  let block: string[] = []

  const flush = (): void => {
    const text = block.join("\n").trim()
    block = []

    if (!tag) {
      setIfFilled(docs, "summary", text)
    } else if (tag === "prop" || tag === "param") {
      if (name && text) {
        const key = tag === "prop" ? "props" : "params"
        ;(docs[key] ??= {})[name] = text
      }
    } else if (tag === "example") {
      if (text) {
        ;(docs.examples ??= []).push(text)
      }
    } else if (tag === "see") {
      if (text) {
        ;(docs.see ??= []).push(text)
      }
    } else {
      setIfFilled(docs, "deprecated", text || "deprecated")
    }
  }

  for (const line of lines) {
    const opened = TAG_LINE.exec(line)

    if (!opened) {
      block.push(line)
      continue
    }

    flush()
    tag = opened[1]
    name = ""

    let rest = line.slice(opened[0].length)

    if (tag === "prop" || tag === "param") {
      const named = NAMED_TAG.exec(rest)
      name = named?.[1] ?? ""
      rest = named ? rest.slice(named[0].length) : rest
    }

    block.push(rest)
  }

  flush()

  return Object.keys(docs).length > 0 ? docs : undefined
}

function setIfFilled(docs: IDocs, key: "summary" | "deprecated", text: string): void {
  if (text && docs[key] === undefined) {
    docs[key] = text
  }
}
