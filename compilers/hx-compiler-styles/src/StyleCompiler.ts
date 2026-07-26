import { BlockCompiler, ICompilerOptions } from "@heleonix/hx-compiler-core"
import type { IBlock, IBlockDocument, IBlockNode, IFrontmatterDocument } from "@heleonix/hx-compiler-core"
import {
  stringifyRuleKey,
  type DimensionUsage,
  type IDimension,
  type IQualifierUsage,
  type IStyleDeclarations,
  type IStyleDefinition,
  type Kind,
} from "@heleonix/hx-language"
import { Errors } from "./errors/Errors"
import { HeleonixStyleCompilerError } from "./errors/HeleonixStyleCompilerError"

const HX_PREFIX = "@hx-"
const MEDIA_PRELUDE = "@media"
const KEYFRAMES_PRELUDE = "@keyframes"

/** A parsed `*.hxs` block prelude, ready for signature composition. */
type Segment =
  | { readonly type: "qualifier"; readonly usage: IQualifierUsage }
  | { readonly type: "element"; readonly usage: IQualifierUsage }
  | { readonly type: "media"; readonly query: string }
  | { readonly type: "style"; readonly forPath: string }
  | { readonly type: "keyframes"; readonly name: string }

interface StyleOutput {
  rules: Record<string, IStyleDeclarations>
  keyframes: Record<string, Record<string, IStyleDeclarations>>
  applies: Record<string, string[]>
}

/**
 * Compiles `*.hxs` source (the shared CSS-subset block grammar) into a
 * platform-neutral {@link IStyleDefinition}: declarations keyed by canonical
 * qualifier signatures, with `{...}` binding sources kept verbatim.
 */
export class StyleCompiler extends BlockCompiler<IStyleDefinition> {
  protected get kind(): Kind {
    return "style"
  }

  protected compileDocument(
    document: IBlockDocument,
    header: IFrontmatterDocument,
    dimension: IDimension,
    options: ICompilerOptions,
  ): IStyleDefinition {
    const output: StyleOutput = { rules: {}, keyframes: {}, applies: {} }

    walk(document.nodes, [], output)

    const definition: IStyleDefinition = {
      name: options.name ?? "",
      dimension,
      usage: normalizeUsage(header.frontmatter["usage"]),
      rules: output.rules,
    }

    if (Object.keys(output.keyframes).length > 0) {
      definition.keyframes = output.keyframes
    }

    if (Object.keys(output.applies).length > 0) {
      definition.applies = output.applies
    }

    return definition
  }
}

function walk(nodes: IBlockNode[], chain: Segment[], output: StyleOutput): void {
  for (const node of nodes) {
    if (node.kind === "declaration") {
      const declarations = (output.rules[composeSignature(chain)] ??= {})

      declarations[node.name] = node.value
    } else if (node.kind === "statement") {
      applyStatement(node.text, chain, output)
    } else {
      walkBlock(node, chain, output)
    }
  }
}

function walkBlock(block: IBlock, chain: Segment[], output: StyleOutput): void {
  const segment = parsePrelude(block.prelude)

  if (segment.type === "keyframes") {
    output.keyframes[segment.name] = collectFrames(block.nodes)

    return
  }

  walk(block.nodes, [...chain, segment], output)
}

function applyStatement(text: string, chain: Segment[], output: StyleOutput): void {
  const token = parseArgs(argsOf(text))["token"]

  if (token === undefined) {
    return
  }

  ;(output.applies[composeSignature(chain)] ??= []).push(token)
}

/**
 * Composes a nesting chain into one canonical rule key. `Style(for:)` segments
 * fold into a single scope (paths joined with `.`), `@media` segments fold into
 * a single query (joined with `and`), and the lone pseudo-element serializes
 * last - everything else keeps nesting order, then the whole key is sorted-arg
 * canonicalized by {@link stringifyRuleKey}.
 */
function composeSignature(chain: Segment[]): string {
  const usages: IQualifierUsage[] = []
  const mediaQueries: string[] = []
  let styleIndex = -1
  let mediaIndex = -1
  let element: IQualifierUsage | undefined

  for (const segment of chain) {
    if (segment.type === "style") {
      if (styleIndex < 0) {
        styleIndex = usages.length
        usages.push({ name: "Style", args: { for: segment.forPath } })
      } else {
        usages[styleIndex].args["for"] += `.${segment.forPath}`
      }
    } else if (segment.type === "media") {
      if (mediaIndex < 0) {
        mediaIndex = usages.length
        usages.push({ name: "Media", args: { query: "" } })
      }

      mediaQueries.push(segment.query)
    } else if (segment.type === "element") {
      if (element) {
        throw new HeleonixStyleCompilerError(Errors.multiplePseudoElements, segment.usage.name, element.name)
      }

      element = segment.usage
    } else if (segment.type === "qualifier") {
      usages.push(segment.usage)
    }
  }

  if (mediaIndex >= 0) {
    usages[mediaIndex].args["query"] = canonicalizeMediaQuery(mediaQueries.join(" and "))
  }

  if (element) {
    usages.push(element)
  }

  return stringifyRuleKey(usages)
}

/** Parses a single block prelude into a signature segment. */
function parsePrelude(prelude: string): Segment {
  if (prelude.charAt(0) === ":") {
    const isElement = prelude.charAt(1) === ":"
    const body = prelude.replace(/^:+/, "")
    const open = body.indexOf("(")
    const rawName = open < 0 ? body : body.slice(0, open)
    const name = pascalCase(rawName)
    const usage: IQualifierUsage =
      open < 0 ? { name, args: {} } : { name, args: {}, positional: body.slice(open + 1, body.lastIndexOf(")")).trim() }

    return { type: isElement ? "element" : "qualifier", usage }
  }

  if (prelude === MEDIA_PRELUDE || prelude.startsWith(`${MEDIA_PRELUDE} `) || prelude.startsWith(`${MEDIA_PRELUDE}(`)) {
    return { type: "media", query: prelude.slice(MEDIA_PRELUDE.length).trim() }
  }

  if (prelude === KEYFRAMES_PRELUDE || prelude.startsWith(`${KEYFRAMES_PRELUDE} `)) {
    return { type: "keyframes", name: prelude.slice(KEYFRAMES_PRELUDE.length).trim() }
  }

  if (prelude.startsWith(HX_PREFIX)) {
    const open = prelude.indexOf("(")
    const word = (open < 0 ? prelude.slice(HX_PREFIX.length) : prelude.slice(HX_PREFIX.length, open)).trim()
    const args = open < 0 ? {} : parseArgs(argsOf(prelude))

    return word === "style"
      ? { type: "style", forPath: args["for"] ?? "" }
      : { type: "qualifier", usage: { name: pascalCase(word), args } }
  }

  if (prelude.charAt(0) === "@") {
    throw new HeleonixStyleCompilerError(Errors.unsupportedAtRule, prelude.slice(1).split(/[\s(]/, 1)[0])
  }

  throw new HeleonixStyleCompilerError(Errors.unexpectedBlock, prelude)
}

function collectFrames(nodes: IBlockNode[]): Record<string, IStyleDeclarations> {
  const frames: Record<string, IStyleDeclarations> = {}

  for (const node of nodes) {
    if (node.kind !== "block") {
      continue
    }

    const declarations: IStyleDeclarations = {}

    for (const child of node.nodes) {
      if (child.kind === "declaration") {
        declarations[child.name] = child.value
      }
    }

    frames[node.prelude] = declarations
  }

  return frames
}

/**
 * Canonicalizes a media query so the same query always yields the same rule key:
 * whitespace normalized, spaces around `:`/`,` removed, and top-level `and`
 * operands (per comma-separated part) sorted alphabetically. Range spelling
 * (`400px <= width <= 700px`) and interpolations are preserved.
 */
function canonicalizeMediaQuery(query: string): string {
  const normalized = query
    .replace(/\s+/g, " ")
    .replace(/\s*:\s*/g, ":")
    .replace(/\s*,\s*/g, ",")
    .trim()

  return splitTopLevel(normalized, ",")
    .map((part) =>
      splitTopLevelWord(part.trim(), "and")
        .map((operand) => operand.trim())
        .sort()
        .join(" and "),
    )
    .join(",")
}

/** Splits `@name(args)` argument text into named args, values kept verbatim. */
function parseArgs(inner: string): Record<string, string> {
  const args: Record<string, string> = {}

  for (const raw of splitTopLevel(inner, ",")) {
    const arg = raw.trim()

    if (arg === "") {
      continue
    }

    const colon = topLevelIndexOf(arg, ":")

    if (colon > 0) {
      args[arg.slice(0, colon).trim()] = arg.slice(colon + 1).trim()
    }
  }

  return args
}

/** Extracts the parenthesized argument text of `@word(...)`. */
function argsOf(text: string): string {
  const open = text.indexOf("(")

  return open < 0 ? "" : text.slice(open + 1, text.lastIndexOf(")"))
}

function pascalCase(name: string): string {
  return name
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")
}

function normalizeUsage(raw: string | undefined): DimensionUsage | undefined {
  return raw === "extend" ? "extend" : raw === "override" ? "override" : undefined
}

function splitTopLevel(input: string, separator: string): string[] {
  const result: string[] = []
  let depth = 0
  let quote = ""
  let start = 0

  for (let i = 0; i < input.length; i++) {
    const ch = input.charAt(i)

    if (quote) {
      if (ch === quote) {
        quote = ""
      }
    } else if (ch === "'" || ch === '"') {
      quote = ch
    } else if (ch === "(" || ch === "[" || ch === "{") {
      depth++
    } else if (ch === ")" || ch === "]" || ch === "}") {
      if (depth > 0) {
        depth--
      }
    } else if (ch === separator && depth === 0) {
      result.push(input.slice(start, i))
      start = i + 1
    }
  }

  result.push(input.slice(start))

  return result
}

/** Splits on a top-level whole word (` word `), used to sort `and` operands. */
function splitTopLevelWord(input: string, word: string): string[] {
  const result: string[] = []
  let depth = 0
  let quote = ""
  let start = 0
  let i = 0

  while (i < input.length) {
    const ch = input.charAt(i)

    if (quote) {
      if (ch === quote) {
        quote = ""
      }

      i++
    } else if (ch === "'" || ch === '"') {
      quote = ch
      i++
    } else if (ch === "(" || ch === "[" || ch === "{") {
      depth++
      i++
    } else if (ch === ")" || ch === "]" || ch === "}") {
      if (depth > 0) {
        depth--
      }

      i++
    } else if (
      depth === 0 &&
      input.charAt(i - 1) === " " &&
      input.startsWith(word, i) &&
      input.charAt(i + word.length) === " "
    ) {
      result.push(input.slice(start, i - 1))
      i += word.length + 1
      start = i
    } else {
      i++
    }
  }

  result.push(input.slice(start))

  return result
}

function topLevelIndexOf(input: string, target: string): number {
  let depth = 0
  let quote = ""

  for (let i = 0; i < input.length; i++) {
    const ch = input.charAt(i)

    if (quote) {
      if (ch === quote) {
        quote = ""
      }
    } else if (ch === "'" || ch === '"') {
      quote = ch
    } else if (ch === "(" || ch === "[" || ch === "{") {
      depth++
    } else if (ch === ")" || ch === "]" || ch === "}") {
      if (depth > 0) {
        depth--
      }
    } else if (ch === target && depth === 0) {
      return i
    }
  }

  return -1
}
