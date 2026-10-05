export function openBraceBefore(text: string, offset: number): number {
  for (let i = offset - 1; i >= 0; i--) {
    const ch = text.charAt(i)

    if (ch === "{") {
      return i
    }

    if (ch === "}" || ch === "\n" || ch === "\r") {
      return -1
    }
  }

  return -1
}
