import { parseStyleValue } from "@heleonix/hx-language"

describe("parseStyleValue", () => {
  it("then splits raw text and unquoted binding sources", () => {
    expect(parseStyleValue("10px {size}px solid {$Colors.border}")).toEqual([
      { kind: "raw", text: "10px " },
      { kind: "binding", source: "size" },
      { kind: "raw", text: "px solid " },
      { kind: "binding", source: "$Colors.border" },
    ])
  })

  it("then trims a source and keeps its converter pipe", () => {
    expect(parseStyleValue("{ @Labels.title | upper }")).toEqual([{ kind: "binding", source: "@Labels.title | upper" }])
  })

  it("then marks sources inside a quoted string as string parts", () => {
    expect(parseStyleValue("'Prefix {@Labels.title}!'")).toEqual([
      {
        kind: "string",
        quote: "'",
        parts: [
          { kind: "raw", text: "Prefix " },
          { kind: "binding", source: "@Labels.title" },
          { kind: "raw", text: "!" },
        ],
      },
    ])
  })

  it("then keeps escapes inside a string, including an escaped quote", () => {
    expect(parseStyleValue('"a \\" {x}"')).toEqual([
      {
        kind: "string",
        quote: '"',
        parts: [
          { kind: "raw", text: 'a \\" ' },
          { kind: "binding", source: "x" },
        ],
      },
    ])
  })

  it("then treats an empty or unterminated brace as raw text", () => {
    expect(parseStyleValue("a {} b {c")).toEqual([{ kind: "raw", text: "a {} b {c" }])
  })

  it("then tolerates an unterminated string", () => {
    expect(parseStyleValue("'open {x}")).toEqual([
      {
        kind: "string",
        quote: "'",
        parts: [
          { kind: "raw", text: "open " },
          { kind: "binding", source: "x" },
        ],
      },
    ])
  })
})
