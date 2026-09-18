import { Errors } from "../errors/Errors"
import { HeleonixCompilerError } from "../errors/HeleonixCompilerError"
import type { IFlatObjectIssue } from "./IFlatObjectIssue"
import type { IJsoncComment } from "./IJsoncComment"
import type { IJsoncEntry } from "./IJsoncEntry"
import type { IJsoncParseResult } from "./IJsoncParseResult"

const CC_TAB = 9
const CC_LF = 10
const CC_CR = 13
const CC_SPACE = 32
const CC_DQUOTE = 34
const CC_PLUS = 43
const CC_COMMA = 44
const CC_MINUS = 45
const CC_DOT = 46
const CC_SLASH = 47
const CC_STAR = 42
const CC_BACKSLASH = 92
const CC_COLON = 58
const CC_LBRACE = 123
const CC_RBRACE = 125
const CC_LBRACKET = 91
const CC_RBRACKET = 93
const CC_0 = 48
const CC_9 = 57
const CC_b = 98
const CC_e_LOWER = 101
const CC_E_UPPER = 69
const CC_f_LOWER = 102
const CC_n_LOWER = 110
const CC_r_LOWER = 114
const CC_t_LOWER = 116
const CC_u_LOWER = 117

const NUMBER_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/

export function parseJsonc(source: string): IJsoncParseResult {
  return new JsoncWalker(source).parse()
}

class JsoncWalker {
  private pos = 0

  private readonly len: number

  private readonly issues: IFlatObjectIssue[] = []

  private readonly entries: IJsoncEntry[] = []

  private readonly comments: IJsoncComment[] = []

  public constructor(private readonly source: string) {
    this.len = source.length
  }

  public parse(): IJsoncParseResult {
    try {
      this.skipWhitespaceAndComments()

      const rootStart = this.pos
      const value = this.parseRootValue()

      this.skipWhitespaceAndComments()

      if (this.pos < this.len) {
        throw new HeleonixCompilerError(Errors.jsoncTrailingData, String(this.pos))
      }

      return { value, issues: this.issues, entries: this.entries, comments: this.comments, rootStart }
    } catch (error) {
      if (error instanceof HeleonixCompilerError && error.offset === undefined) {
        error.offset = this.pos
      }

      throw error
    }
  }

  private parseRootValue(): unknown {
    if (this.peek() === CC_LBRACE) {
      return this.parseObject(true)
    }

    const start = this.pos
    const value = this.parseValue()

    this.issues.push({ kind: "notObject", start, end: this.pos })

    return value
  }

  private recordFlatValue(key: string, value: unknown, start: number, end: number): void {
    if (typeof value === "string") {
      return
    }

    const nested = value !== null && typeof value === "object"

    this.issues.push({ kind: nested ? "nested" : "nonString", start, end, key })
  }

  private parseValue(): unknown {
    if (this.pos >= this.len) {
      throw new HeleonixCompilerError(Errors.jsoncUnexpectedEnd, String(this.pos))
    }

    const c = this.source.charCodeAt(this.pos)

    if (c === CC_LBRACE) {
      return this.parseObject()
    }

    if (c === CC_LBRACKET) {
      return this.parseArray()
    }

    if (c === CC_DQUOTE) {
      return this.parseString()
    }

    if (c === CC_MINUS || (c >= CC_0 && c <= CC_9)) {
      return this.parseNumber()
    }

    if (this.startsWith("true")) {
      this.pos += 4
      return true
    }

    if (this.startsWith("false")) {
      this.pos += 5
      return false
    }

    if (this.startsWith("null")) {
      this.pos += 4
      return null
    }

    throw new HeleonixCompilerError(Errors.jsoncUnexpectedChar, this.source.charAt(this.pos), String(this.pos))
  }

  private parseObject(flatRoot = false): Record<string, unknown> {
    this.pos++ // consume '{'

    const result: Record<string, unknown> = {}

    this.skipWhitespaceAndComments()

    if (this.peek() === CC_RBRACE) {
      this.pos++
      return result
    }

    for (;;) {
      this.skipWhitespaceAndComments()

      if (this.peek() !== CC_DQUOTE) {
        this.fail()
      }

      const keyStart = this.pos
      const key = this.parseString()
      const keyEnd = this.pos

      this.skipWhitespaceAndComments()

      if (this.peek() !== CC_COLON) {
        this.fail()
      }

      this.pos++ // consume ':'

      this.skipWhitespaceAndComments()

      const valueStart = this.pos
      const value = this.parseValue()

      result[key] = value

      if (flatRoot) {
        this.recordFlatValue(key, value, valueStart, this.pos)
        this.entries.push({ key, keyStart, keyEnd, valueStart, valueEnd: this.pos })
      }

      this.skipWhitespaceAndComments()

      const c = this.peek()

      if (c === CC_COMMA) {
        this.pos++ // consume ','

        this.skipWhitespaceAndComments()

        if (this.peek() === CC_RBRACE) {
          // Trailing comma.
          this.pos++
          return result
        }

        continue
      }

      if (c === CC_RBRACE) {
        this.pos++
        return result
      }

      this.fail()
    }
  }

  private parseArray(): unknown[] {
    this.pos++ // consume '['

    const result: unknown[] = []

    this.skipWhitespaceAndComments()

    if (this.peek() === CC_RBRACKET) {
      this.pos++
      return result
    }

    for (;;) {
      this.skipWhitespaceAndComments()

      result.push(this.parseValue())

      this.skipWhitespaceAndComments()

      const c = this.peek()

      if (c === CC_COMMA) {
        this.pos++ // consume ','

        this.skipWhitespaceAndComments()

        if (this.peek() === CC_RBRACKET) {
          // Trailing comma.
          this.pos++
          return result
        }

        continue
      }

      if (c === CC_RBRACKET) {
        this.pos++
        return result
      }

      this.fail()
    }
  }

  private parseString(): string {
    const start = this.pos

    this.pos++ // consume opening '"'

    let result = ""
    let runStart = this.pos

    while (this.pos < this.len) {
      const c = this.source.charCodeAt(this.pos)

      if (c === CC_DQUOTE) {
        result += this.source.slice(runStart, this.pos)
        this.pos++ // consume closing '"'
        return result
      }

      if (c === CC_BACKSLASH) {
        result += this.source.slice(runStart, this.pos)
        this.pos++ // consume '\'
        result += this.readEscape(start)
        runStart = this.pos

        continue
      }

      if (c < CC_SPACE) {
        throw new HeleonixCompilerError(Errors.jsoncInvalidString, String(start), "control characters must be escaped")
      }

      this.pos++
    }

    throw new HeleonixCompilerError(Errors.jsoncUnexpectedEnd, String(start))
  }

  private readEscape(stringStart: number): string {
    if (this.pos >= this.len) {
      throw new HeleonixCompilerError(Errors.jsoncUnexpectedEnd, String(stringStart))
    }

    const c = this.source.charCodeAt(this.pos)

    this.pos++

    switch (c) {
      case CC_DQUOTE:
        return '"'
      case CC_BACKSLASH:
        return "\\"
      case CC_SLASH:
        return "/"
      case CC_b:
        return "\b"
      case CC_f_LOWER:
        return "\f"
      case CC_n_LOWER:
        return "\n"
      case CC_r_LOWER:
        return "\r"
      case CC_t_LOWER:
        return "\t"
      case CC_u_LOWER:
        return this.readUnicodeEscape(stringStart)
      default:
        throw new HeleonixCompilerError(
          Errors.jsoncInvalidString,
          String(stringStart),
          `invalid escape '\\${this.source.charAt(this.pos - 1)}'`,
        )
    }
  }

  private readUnicodeEscape(stringStart: number): string {
    if (this.pos + 4 > this.len) {
      throw new HeleonixCompilerError(Errors.jsoncUnexpectedEnd, String(stringStart))
    }

    const hex = this.source.slice(this.pos, this.pos + 4)

    if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
      throw new HeleonixCompilerError(
        Errors.jsoncInvalidString,
        String(stringStart),
        `invalid unicode escape '\\u${hex}'`,
      )
    }

    this.pos += 4

    return String.fromCharCode(parseInt(hex, 16))
  }

  private parseNumber(): number {
    const start = this.pos

    if (this.peek() === CC_MINUS) {
      this.pos++
    }

    while (this.pos < this.len) {
      const c = this.source.charCodeAt(this.pos)

      if (
        (c >= CC_0 && c <= CC_9) ||
        c === CC_DOT ||
        c === CC_PLUS ||
        c === CC_MINUS ||
        c === CC_e_LOWER ||
        c === CC_E_UPPER
      ) {
        this.pos++
      } else {
        break
      }
    }

    const literal = this.source.slice(start, this.pos)

    if (!NUMBER_PATTERN.test(literal)) {
      throw new HeleonixCompilerError(Errors.jsoncInvalidNumber, literal, String(start))
    }

    return Number(literal)
  }

  private skipWhitespaceAndComments(): void {
    while (this.pos < this.len) {
      const c = this.source.charCodeAt(this.pos)

      if (c === CC_SPACE || c === CC_TAB || c === CC_LF || c === CC_CR) {
        this.pos++

        continue
      }

      if (c === CC_SLASH) {
        const next = this.source.charCodeAt(this.pos + 1)

        if (next === CC_SLASH) {
          this.skipLineComment()

          continue
        }

        if (next === CC_STAR) {
          this.skipBlockComment()

          continue
        }
      }

      break
    }
  }

  private skipLineComment(): void {
    this.pos += 2 // '//'

    while (this.pos < this.len) {
      const c = this.source.charCodeAt(this.pos)

      if (c === CC_LF || c === CC_CR) {
        break
      }

      this.pos++
    }
  }

  private skipBlockComment(): void {
    const start = this.pos

    this.pos += 2 // '/*'

    const end = this.source.indexOf("*/", this.pos)

    if (end === -1) {
      throw new HeleonixCompilerError(Errors.jsoncUnexpectedEnd, String(this.pos))
    }

    this.pos = end + 2
    this.comments.push({ value: this.source.slice(start + 2, end), start, end: this.pos })
  }

  private peek(): number {
    return this.pos < this.len ? this.source.charCodeAt(this.pos) : -1
  }

  private fail(): never {
    if (this.pos >= this.len) {
      throw new HeleonixCompilerError(Errors.jsoncUnexpectedEnd, String(this.pos))
    }

    throw new HeleonixCompilerError(Errors.jsoncUnexpectedChar, this.source.charAt(this.pos), String(this.pos))
  }

  private startsWith(s: string): boolean {
    const n = s.length

    if (this.pos + n > this.len) {
      return false
    }

    for (let i = 0; i < n; i++) {
      if (this.source.charCodeAt(this.pos + i) !== s.charCodeAt(i)) {
        return false
      }
    }

    return true
  }
}
