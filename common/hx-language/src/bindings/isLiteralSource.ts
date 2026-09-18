const NUMBER = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/

export function isLiteralSource(source: string): boolean {
  return source === "true" || source === "false" || NUMBER.test(source)
}
