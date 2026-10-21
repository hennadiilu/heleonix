// VS Code glob semantics over `/`-separated relative paths: `**/` spans any
// number of whole segments (none included), `*` and `?` stay within a segment,
// `{a,b}` is an alternation. Windows paths compare case-insensitively.
export function globToRegExp(glob: string): RegExp {
  const pattern = glob.replace(/\\/g, "/")
  let source = ""
  let depth = 0

  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern.charAt(i)

    if (ch === "*" && pattern.charAt(i + 1) === "*") {
      const segments = pattern.charAt(i + 2) === "/"

      source += segments ? "(?:.*/)?" : ".*"
      i += segments ? 2 : 1
    } else if (ch === "*") {
      source += "[^/]*"
    } else if (ch === "?") {
      source += "[^/]"
    } else if (ch === "{") {
      source += "(?:"
      depth++
    } else if (ch === "}" && depth > 0) {
      source += ")"
      depth--
    } else if (ch === "," && depth > 0) {
      source += "|"
    } else {
      source += ch.replace(/[.+^$()|[\]\\{}]/g, "\\$&")
    }
  }

  return new RegExp(`^${source}$`, process.platform === "win32" ? "i" : "")
}
