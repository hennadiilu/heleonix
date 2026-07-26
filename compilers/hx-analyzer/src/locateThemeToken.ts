interface ISourcePosition {
  line: number
  character: number
  length: number
}

const SPECIAL = /[.*+?^${}()|[\]\\]/g

/**
 * Locates a theme token's leaf declaration in a `*.hxt` source by its dot-path,
 * narrowing through each ancestor group block (`Group {`) before matching the
 * leaf `name:` declaration, so same-named leaves in different groups resolve to
 * the right one. Returns the leaf name's zero-based line/character and length,
 * or `undefined` when the path is not textually present (a naive, comment-
 * unaware scan - consistent with the analyzer's subject-based range mapping).
 */
export function locateThemeToken(source: string, path: string): ISourcePosition | undefined {
  const segments = path.split(".")
  let from = 0

  for (let index = 0; index < segments.length - 1; index++) {
    const open = groupOpenAfter(source, segments[index], from)

    if (open < 0) {
      return undefined
    }

    from = open
  }

  const leaf = segments[segments.length - 1]
  const at = declarationAfter(source, leaf, from)

  return at < 0 ? undefined : { ...lineCharacterOf(source, at), length: leaf.length }
}

/** Index just past the `{` opening the group named `name` at or after `from`, or -1. */
function groupOpenAfter(source: string, name: string, from: number): number {
  const match = boundedMatch(source, name, "\\{", from)

  return match ? match.index + match.length : -1
}

/** Index of the `name` token of a `name:` declaration at or after `from`, or -1. */
function declarationAfter(source: string, name: string, from: number): number {
  const match = boundedMatch(source, name, ":", from)

  return match ? match.index : -1
}

/** First `<boundary>name<ws><terminator>` at or after `from`, with the name's start index and match length. */
function boundedMatch(
  source: string,
  name: string,
  terminator: string,
  from: number,
): { index: number; length: number } | undefined {
  const regex = new RegExp(`(^|[\\s{;,])(${name.replace(SPECIAL, "\\$&")})\\s*${terminator}`, "g")

  regex.lastIndex = from

  const match = regex.exec(source)

  return match
    ? { index: match.index + match[1].length, length: regex.lastIndex - match.index - match[1].length }
    : undefined
}

function lineCharacterOf(source: string, offset: number): { line: number; character: number } {
  let line = 0
  let lineStart = 0

  for (let index = 0; index < offset; index++) {
    if (source.charAt(index) === "\n") {
      line++
      lineStart = index + 1
    }
  }

  return { line, character: offset - lineStart }
}
