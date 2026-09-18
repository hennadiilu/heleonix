interface ISourcePosition {
  line: number
  character: number
  length: number
}

const SPECIAL = /[.*+?^${}()|[\]\\]/g

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

function groupOpenAfter(source: string, name: string, from: number): number {
  const match = boundedMatch(source, name, "\\{", from)

  return match ? match.index + match.length : -1
}

function declarationAfter(source: string, name: string, from: number): number {
  const match = boundedMatch(source, name, ":", from)

  return match ? match.index : -1
}

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
