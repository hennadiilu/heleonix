import type { IStyleVariable } from "@heleonix/hx-core"

const UNSAFE = /[;{}]|!\s*important|url\s*\(|expression\s*\(/i

// A text variable becomes a CSS string, escaped so no value can end it early.
// A raw value that could escape its declaration or inject behavior is rejected
// (undefined): the variable is left unset and the declaration falls back.
export function cssVariableValue(variable: IStyleVariable, value: string): string | undefined {
  if (variable.text) {
    return `"${value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\r\n|\r|\n/g, "\\A ")}"`
  }

  return UNSAFE.test(value) ? undefined : value
}
