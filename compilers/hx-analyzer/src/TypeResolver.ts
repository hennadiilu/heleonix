import path from "node:path"
import ts from "typescript"
import type { IQualifierArg, QualifierRefKind } from "@heleonix/hx-language"
import type { IDiscoveredClass } from "./IDiscoveredClass"
import type { IDiscoveredComponent } from "./IDiscoveredComponent"
import type { IDiscoveredQualifier } from "./IDiscoveredQualifier"
import type { IMemberType, MemberKind } from "./IMemberType"
import type { IResolvedType } from "./IResolvedType"
import type { ITypeProgramHost } from "./ITypeProgramHost"

const QUALIFIER_BASE = "StyleQualifier"
const QUALIFIER_SUFFIX = "Qualifier"
const COMPONENT_BASE = "Component"

/** One header type to resolve: its owning `.hxm` directory and the raw text. */
export interface ITypeRequest {
  id: string

  dir: string

  typeText: string
}

const ALIAS = "__HxType"

/**
 * Resolves component/converter header type text through the TypeScript
 * compiler. Each request is synthesized into a virtual `.ts` module
 * co-located with its `.hxm` (so `import("./…")` reference forms resolve
 * relative to the component), typed as `export type __HxType = (<text>)`, and
 * its members are read from the checker.
 *
 * Filesystem-free by design: all file access goes through the injected
 * {@link ITypeProgramHost}, so the analyzer runs unchanged in Node (disk host)
 * and in the browser (in-memory host, e.g. StackBlitz).
 */
export class TypeResolver {
  private readonly programHost: ITypeProgramHost

  // Reused as the `oldProgram` of the next creation so TypeScript reuses the
  // unchanged structure (lib, unedited project files) instead of rebuilding it.
  private oldProgram?: ts.Program

  // Style qualifiers found by the most recent `discover()` scan (collected in
  // the same pass as converters/actions; read via `qualifiers()`).
  private lastQualifiers: IDiscoveredQualifier[] = []

  // Programmatic components found by the most recent `discover()` scan.
  private lastComponents: IDiscoveredComponent[] = []

  public constructor(programHost: ITypeProgramHost) {
    this.programHost = programHost
  }

  /** Style qualifiers found by the most recent {@link discover} scan. */
  public qualifiers(): IDiscoveredQualifier[] {
    return this.lastQualifiers
  }

  /** Programmatic components found by the most recent {@link discover} scan. */
  public components(): IDiscoveredComponent[] {
    return this.lastComponents
  }

  public resolve(requests: readonly ITypeRequest[]): Map<string, IResolvedType> {
    const result = new Map<string, IResolvedType>()

    if (requests.length === 0) {
      return result
    }

    // Real paths keep their case so `import("./…")` module resolution works; the
    // overlay Map is keyed case-insensitively so the host's lookups match.
    const virtual = new Map<string, string>()
    const rootNames: string[] = []
    const idByPath = new Map<string, string>()

    requests.forEach((request, index) => {
      const realPath = path.join(request.dir, `__hxtype_${index}.ts`)

      virtual.set(normalize(realPath), `export type ${ALIAS} = (${request.typeText})\n`)
      rootNames.push(realPath)
      idByPath.set(realPath, request.id)
    })

    const host = overlay(this.programHost.host, virtual)
    // The project's own files are included so ambient/global types and bare
    // workspace type references resolve, alongside the virtual header modules.
    const program = ts.createProgram(
      [...this.programHost.rootFiles, ...rootNames],
      this.programHost.options,
      host,
      this.oldProgram,
    )

    this.oldProgram = program

    const checker = program.getTypeChecker()

    for (const [realPath, id] of idByPath) {
      const source = program.getSourceFile(realPath)

      result.set(id, source ? resolveAlias(source, checker) : { resolved: false, members: [] })
    }

    return result
  }

  /**
   * Scans the project's own `.ts` files for non-abstract classes extending the
   * `Converter` / `Action` base, reading each one's `TParams`
   * (`Parameters<Class["format"]>[1]` / `Parameters<Class["Execute"]>[0]`) into
   * member facts. Base classes are matched by name up the heritage chain, so a
   * class extending an intermediate abstract subclass is still found.
   */
  public discover(): IDiscoveredClass[] {
    const program = ts.createProgram(
      [...this.programHost.rootFiles],
      this.programHost.options,
      this.programHost.host,
      this.oldProgram,
    )

    this.oldProgram = program

    const checker = program.getTypeChecker()
    const result: IDiscoveredClass[] = []
    const qualifiers: IDiscoveredQualifier[] = []
    const components: IDiscoveredComponent[] = []

    for (const source of program.getSourceFiles()) {
      if (source.isDeclarationFile || source.fileName.includes("node_modules")) {
        continue
      }

      for (const node of source.statements) {
        if (!ts.isClassDeclaration(node) || !node.name || isAbstract(node)) {
          continue
        }

        const symbol = checker.getSymbolAtLocation(node.name)

        if (!symbol) {
          continue
        }

        const instanceType = checker.getDeclaredTypeOfSymbol(symbol)
        const matched = matchBase(instanceType, checker)

        if (!matched) {
          continue
        }

        const className = node.name.text
        const at = source.getLineAndCharacterOfPosition(node.name.getStart())
        const docs = ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim()

        if (matched.base === QUALIFIER_BASE) {
          const suffixOk = className.length > QUALIFIER_SUFFIX.length && className.endsWith(QUALIFIER_SUFFIX)
          const argType = checker.getTypeArguments(matched.type as ts.TypeReference)[0]
          const qualifier: IDiscoveredQualifier = {
            className,
            name: suffixOk ? className.slice(0, -QUALIFIER_SUFFIX.length) : className,
            suffixOk,
            file: source.fileName,
            line: at.line,
            character: at.character,
            args: argType ? resolveQualifierArgs(argType, checker, node) : [],
          }

          if (docs) {
            qualifier.docs = docs
          }

          qualifiers.push(qualifier)

          continue
        }

        if (matched.base === COMPONENT_BASE) {
          // A programmatic component's contract is its two type arguments; the
          // tag is the class name verbatim (no suffix).
          const args = checker.getTypeArguments(matched.type as ts.TypeReference)
          const component: IDiscoveredComponent = {
            name: className,
            file: source.fileName,
            line: at.line,
            character: at.character,
            props: args[0] ? resolveMembers(args[0], checker, node) : [],
            events: args[1] ? resolveMembers(args[1], checker, node) : [],
          }

          if (docs) {
            component.docs = docs
          }

          components.push(component)

          continue
        }

        const [method, paramIndex] = matched.base === "Converter" ? (["format", 1] as const) : (["Execute", 0] as const)
        const suffixOk = className.length > matched.base.length && className.endsWith(matched.base)

        const discovered: IDiscoveredClass = {
          className,
          base: matched.base,
          name: suffixOk ? className.slice(0, -matched.base.length) : className,
          suffixOk,
          file: source.fileName,
          line: at.line,
          character: at.character,
          params: readParams(instanceType, checker, node, method, paramIndex),
        }

        if (docs) {
          discovered.docs = docs
        }

        result.push(discovered)
      }
    }

    this.lastQualifiers = qualifiers
    this.lastComponents = components

    return result
  }
}

function isAbstract(node: ts.ClassDeclaration): boolean {
  return node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AbstractKeyword) ?? false
}

/**
 * Walks the heritage chain and returns which framework base a class extends
 * (with the matched, instantiated base type so a qualifier's `TArgs` type
 * argument can be read), or undefined.
 */
function matchBase(
  type: ts.Type,
  checker: ts.TypeChecker,
): { base: "Converter" | "Action" | "StyleQualifier" | "Component"; type: ts.Type } | undefined {
  const stack = [...baseTypes(type, checker)]
  const seen = new Set<ts.Symbol>()

  while (stack.length > 0) {
    const current = stack.pop() as ts.Type
    const name = current.symbol?.getName()

    if (name === "Converter" || name === "Action" || name === QUALIFIER_BASE || name === COMPONENT_BASE) {
      return { base: name, type: current }
    }

    if (current.symbol) {
      if (seen.has(current.symbol)) {
        continue
      }

      seen.add(current.symbol)
    }

    stack.push(...baseTypes(current, checker))
  }

  return undefined
}

function baseTypes(type: ts.Type, checker: ts.TypeChecker): readonly ts.Type[] {
  return type.isClassOrInterface() ? (checker.getBaseTypes(type) ?? []) : []
}

/** Members of a class method's parameter at `paramIndex`, with generics substituted for the concrete class. */
function readParams(
  instanceType: ts.Type,
  checker: ts.TypeChecker,
  node: ts.Node,
  method: string,
  paramIndex: number,
): IMemberType[] {
  const symbol = instanceType.getProperty(method)

  if (!symbol) {
    return []
  }

  const signature = checker.getTypeOfSymbolAtLocation(symbol, node).getCallSignatures()[0]

  if (!signature || signature.parameters.length <= paramIndex) {
    return []
  }

  return resolveMembers(checker.getTypeOfSymbolAtLocation(signature.parameters[paramIndex], node), checker, node)
}

function resolveAlias(source: ts.SourceFile, checker: ts.TypeChecker): IResolvedType {
  const alias = source.statements.find(
    (statement): statement is ts.TypeAliasDeclaration =>
      ts.isTypeAliasDeclaration(statement) && statement.name.text === ALIAS,
  )

  if (!alias) {
    return { resolved: false, members: [] }
  }

  const type = checker.getTypeAtLocation(alias.type)

  // An unresolved type name collapses to `any`/`error`; treat it as unresolved
  // so the analyzer can report it rather than silently accepting anything.
  if (type.flags & ts.TypeFlags.Any) {
    return { resolved: false, members: [] }
  }

  return { resolved: true, members: resolveMembers(type, checker, alias) }
}

/**
 * Enumerates and classifies the members of a data type (a component prop type
 * or a converter/action `TParams`) into {@link IMemberType} facts. Shared so an
 * inline prop type and a class's params yield identical member facts. `location`
 * is a node for `getTypeOfSymbolAtLocation`; defaults to a member's own
 * declaration when omitted.
 */
export function resolveMembers(type: ts.Type, checker: ts.TypeChecker, location?: ts.Node): IMemberType[] {
  const members: IMemberType[] = []

  for (const symbol of checker.getPropertiesOfType(type)) {
    const at = location ?? symbol.valueDeclaration
    const declared = at ? checker.getTypeOfSymbolAtLocation(symbol, at) : checker.getTypeOfSymbol(symbol)
    const optional = Boolean(symbol.flags & ts.SymbolFlags.Optional)
    const valueType = optional ? checker.getNonNullableType(declared) : declared
    const classified = classify(valueType, checker)
    const member: IMemberType = {
      name: symbol.getName(),
      optional,
      kind: classified.kind,
      isFunction: classified.isFunction,
    }

    if (classified.enumValues) {
      member.enumValues = classified.enumValues
    }

    if (isReadonly(symbol)) {
      member.readonly = true
    }

    const docs = ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim()

    if (docs) {
      member.docs = docs
    }

    members.push(member)
  }

  return members
}

/**
 * Resolves a qualifier's `TArgs` members like {@link resolveMembers}, plus the
 * branded `refKind` of any member typed as `PropertyRef`/`EventRef`/
 * `ThemeTokenRef` - detected by the type alias name, so it works regardless of
 * which package declares the brand.
 */
function resolveQualifierArgs(type: ts.Type, checker: ts.TypeChecker, location: ts.Node): IQualifierArg[] {
  const refKinds = new Map<string, QualifierRefKind>()

  for (const symbol of checker.getPropertiesOfType(type)) {
    const declared = checker.getTypeOfSymbolAtLocation(symbol, location)
    const kind = refKindOf(checker.getNonNullableType(declared))

    if (kind) {
      refKinds.set(symbol.getName(), kind)
    }
  }

  return resolveMembers(type, checker, location).map((member) => {
    const refKind = refKinds.get(member.name)

    return refKind ? { ...member, refKind } : member
  })
}

function refKindOf(type: ts.Type): QualifierRefKind | undefined {
  switch (type.aliasSymbol?.getName()) {
    case "PropertyRef":
      return "property"
    case "EventRef":
      return "event"
    case "ThemeTokenRef":
      return "theme"
    default:
      return undefined
  }
}

/** Whether a member is declared `readonly` (an input-only action parameter). */
function isReadonly(symbol: ts.Symbol): boolean {
  return (symbol.declarations ?? []).some(
    (declaration) => (ts.getCombinedModifierFlags(declaration) & ts.ModifierFlags.Readonly) !== 0,
  )
}

function classify(
  type: ts.Type,
  checker: ts.TypeChecker,
): { kind: MemberKind; enumValues?: string[]; isFunction: boolean } {
  if (type.getCallSignatures().length > 0) {
    return { kind: "unknown", isFunction: true }
  }

  const literals = stringLiteralUnion(type)

  if (literals) {
    return { kind: "enum", enumValues: literals, isFunction: false }
  }

  if (type.flags & ts.TypeFlags.StringLike) {
    return { kind: "string", isFunction: false }
  }

  if (type.flags & ts.TypeFlags.NumberLike) {
    return { kind: "number", isFunction: false }
  }

  if (type.flags & ts.TypeFlags.BooleanLike) {
    return { kind: "boolean", isFunction: false }
  }

  if (checker.isArrayType(type) || checker.isTupleType(type)) {
    return { kind: "array", isFunction: false }
  }

  if (type.flags & ts.TypeFlags.Object) {
    return { kind: "object", isFunction: false }
  }

  return { kind: "unknown", isFunction: false }
}

/** The members of a union of string literals (a `'a' | 'b'` prop or string enum), or undefined. */
function stringLiteralUnion(type: ts.Type): string[] | undefined {
  if (!type.isUnion()) {
    return type.isStringLiteral() ? [type.value] : undefined
  }

  const values: string[] = []

  for (const part of type.types) {
    if (part.isStringLiteral()) {
      values.push(part.value)
    } else {
      return undefined
    }
  }

  return values.length > 0 ? values : undefined
}

/** Wraps a host so the virtual header modules are served before the real files. */
function overlay(base: ts.CompilerHost, virtual: Map<string, string>): ts.CompilerHost {
  const getSourceFile = base.getSourceFile.bind(base)
  const fileExists = base.fileExists.bind(base)
  const readFile = base.readFile.bind(base)

  return {
    ...base,
    getSourceFile: (fileName, languageVersion, onError, shouldCreate) => {
      const content = virtual.get(normalize(fileName))

      return content !== undefined
        ? ts.createSourceFile(fileName, content, languageVersion, true)
        : getSourceFile(fileName, languageVersion, onError, shouldCreate)
    },
    fileExists: (fileName) => virtual.has(normalize(fileName)) || fileExists(fileName),
    readFile: (fileName) => virtual.get(normalize(fileName)) ?? readFile(fileName),
  }
}

function normalize(fileName: string): string {
  return path.resolve(fileName).replace(/\\/g, "/").toLowerCase()
}
