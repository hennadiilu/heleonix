import { STRING_QUOTES } from "./STRING_QUOTES"

export function isStringLiteralSource(source: string): boolean {
  const quote = source.charAt(0)

  return (
    source.length >= 2 &&
    STRING_QUOTES.includes(quote) &&
    source.charAt(source.length - 1) === quote &&
    source.indexOf(quote, 1) === source.length - 1
  )
}
