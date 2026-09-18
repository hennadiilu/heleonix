const SEP = "\u0000"

export function compositeKey(left: string, right: string): string {
  return `${left}${SEP}${right}`
}

export function splitCompositeKey(key: string): [string, string] {
  const at = key.indexOf(SEP)

  return at < 0 ? [key, ""] : [key.slice(0, at), key.slice(at + 1)]
}
