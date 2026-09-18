import { BlockCompiler, ICompilerOptions } from "@heleonix/hx-compiler-core"
import type { IBlock, IBlockDocument, IBlockNode, IFrontmatterDocument } from "@heleonix/hx-compiler-core"
import type {
  DimensionUsage,
  IDimension,
  IStyleDeclarations,
  IThemeDefinition,
  IThemeGroup,
  Kind,
} from "@heleonix/hx-language"
import { Errors } from "./errors/Errors"
import { HeleonixThemeCompilerError } from "./errors/HeleonixThemeCompilerError"

const FONT_FACE_PRELUDE = "@font-face"
const KEYFRAMES_PRELUDE = "@keyframes"
const COUNTER_STYLE_PRELUDE = "@counter-style"

interface Artifacts {
  keyframes: Record<string, Record<string, IStyleDeclarations>>
  fontFaces: IStyleDeclarations[]
  counterStyles: Record<string, IStyleDeclarations>
}

export class ThemeCompiler extends BlockCompiler<IThemeDefinition> {
  protected get kind(): Kind {
    return "theme"
  }

  protected compileDocument(
    document: IBlockDocument,
    header: IFrontmatterDocument,
    dimension: IDimension,
    options: ICompilerOptions,
  ): IThemeDefinition {
    const groups: IThemeGroup = {}
    const artifacts: Artifacts = { keyframes: {}, fontFaces: [], counterStyles: {} }

    buildTree(document.nodes, groups, artifacts)

    const definition: IThemeDefinition = {
      name: options.name ?? "",
      dimension,
      usage: normalizeUsage(header.frontmatter["usage"]),
      groups,
    }

    if (Object.keys(artifacts.keyframes).length > 0) {
      definition.keyframes = artifacts.keyframes
    }

    if (artifacts.fontFaces.length > 0) {
      definition.fontFaces = artifacts.fontFaces
    }

    if (Object.keys(artifacts.counterStyles).length > 0) {
      definition.counterStyles = artifacts.counterStyles
    }

    return definition
  }
}

function buildTree(nodes: IBlockNode[], group: IThemeGroup, artifacts: Artifacts): void {
  for (const node of nodes) {
    if (node.kind === "declaration") {
      if (node.name in group) {
        throw new HeleonixThemeCompilerError(Errors.duplicateToken, node.name)
      }

      group[node.name] = node.value
    } else if (node.kind === "statement") {
      throw new HeleonixThemeCompilerError(Errors.unexpectedStatement, node.text)
    } else {
      buildBlock(node, group, artifacts)
    }
  }
}

function buildBlock(block: IBlock, group: IThemeGroup, artifacts: Artifacts): void {
  const prelude = block.prelude

  if (prelude === FONT_FACE_PRELUDE) {
    artifacts.fontFaces.push(collectDeclarations(block.nodes))

    return
  }

  if (prelude.startsWith(`${KEYFRAMES_PRELUDE} `)) {
    register(
      artifacts.keyframes,
      "keyframes",
      prelude.slice(KEYFRAMES_PRELUDE.length).trim(),
      collectFrames(block.nodes),
    )

    return
  }

  if (prelude.startsWith(`${COUNTER_STYLE_PRELUDE} `)) {
    register(
      artifacts.counterStyles,
      "counter-style",
      prelude.slice(COUNTER_STYLE_PRELUDE.length).trim(),
      collectDeclarations(block.nodes),
    )

    return
  }

  if (prelude.charAt(0) === "@") {
    throw new HeleonixThemeCompilerError(Errors.unsupportedAtRule, prelude.slice(1).split(/[\s(]/, 1)[0])
  }

  if (prelude.charAt(0) === ":") {
    throw new HeleonixThemeCompilerError(Errors.unexpectedBlock, prelude)
  }

  buildTree(block.nodes, groupFor(group, prelude), artifacts)
}

function groupFor(parent: IThemeGroup, name: string): IThemeGroup {
  const existing = parent[name]

  if (existing === undefined) {
    const created: IThemeGroup = {}
    parent[name] = created

    return created
  }

  if (typeof existing === "string") {
    throw new HeleonixThemeCompilerError(Errors.duplicateToken, name)
  }

  return existing
}

function register<T>(target: Record<string, T>, artifact: string, name: string, value: T): void {
  if (name in target) {
    throw new HeleonixThemeCompilerError(Errors.duplicateArtifact, artifact, name)
  }

  target[name] = value
}

function collectDeclarations(nodes: IBlockNode[]): IStyleDeclarations {
  const declarations: IStyleDeclarations = {}

  for (const node of nodes) {
    if (node.kind === "declaration") {
      declarations[node.name] = node.value
    }
  }

  return declarations
}

function collectFrames(nodes: IBlockNode[]): Record<string, IStyleDeclarations> {
  const frames: Record<string, IStyleDeclarations> = {}

  for (const node of nodes) {
    if (node.kind === "block") {
      frames[node.prelude] = collectDeclarations(node.nodes)
    }
  }

  return frames
}

function normalizeUsage(raw: string | undefined): DimensionUsage | undefined {
  return raw === "extend" ? "extend" : raw === "override" ? "override" : undefined
}
