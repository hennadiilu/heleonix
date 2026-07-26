import {
  XmlCompiler,
  ICompilerOptions,
  IXmlElement,
  IXmlNode,
  splitFrontmatter,
  type IFrontmatterDocument,
} from "@heleonix/hx-compiler-core"
import {
  COMPONENT_NAME_SEGMENT_SEPARATOR,
  CONTENT_TAG,
  IDENTIFIER_PATTERN,
  NAME_ATTRIBUTE,
  ROOT_TAG,
  getOverrideTarget,
  isBindingExpression,
  parseBindingExpression,
  parseDocComment,
  type IBindingExpression,
  type IComponentHeader,
  type IComponentOverride,
  type IDocs,
  type IDocsEntry,
  type Kind,
} from "@heleonix/hx-language"
import type { IComponentDefinition, IComponentProperty, IComponentUsage } from "@heleonix/hx-language"
import type { IDimension } from "@heleonix/hx-language"
import { Errors } from "./errors/Errors"
import { HeleonixComponentCompilerError } from "./errors/HeleonixComponentCompilerError"

const CONTENT_NAME = "content"
const VALUE_PROPERTY = "value"

const OVERRIDE_TARGET = new RegExp(
  `^${IDENTIFIER_PATTERN}(\\${COMPONENT_NAME_SEGMENT_SEPARATOR}${IDENTIFIER_PATTERN})*$`,
)

/**
 * Compiles `*.hxm` component source into an `IComponentDefinition`-compatible
 * JSON shape that the runtime `ComponentDefinitionProvider` can hand to
 * `DeclarativeComponent` for building/updating component trees.
 *
 * The root `<Component>` element is a compile-time wrapper only; its children
 * become the compiled definition's `children`. Text nodes that contain a
 * binding expression are emitted as a single `Content` child with a `value`
 * property binding.
 *
 * A `target:Component` attribute or `<target:Component>` child element is a
 * component override: it is diverted onto the usage's `overrides` (resolved at
 * build time to swap the target component) rather than becoming a property
 * binding or a child component.
 */
export class ComponentCompiler extends XmlCompiler<IComponentDefinition> {
  protected get rootTag(): string {
    return ROOT_TAG
  }

  protected get kind(): Kind {
    return "component"
  }

  /**
   * Compiles the compile-time facts of the typings frontmatter: the component
   * summary and the declared props/events with their typings and doc texts.
   * Tolerant by design, like `compileDocs` - facts are consumed by tooling,
   * so unparsable source yields `undefined` (`compile` reports the real
   * problems).
   */
  public compileHeader(source: string): IComponentHeader | undefined {
    let header: IFrontmatterDocument

    try {
      header = splitFrontmatter(source)
    } catch {
      return undefined
    }

    const result: IComponentHeader = {}

    if (header.docs) {
      result.docs = header.docs
    }

    // props/events/params are opaque TypeScript type text - the analyzer hands
    // them to the TypeScript compiler; the DSL never parses them here.
    if (header.types?.["props"]) {
      result.props = header.types["props"]
    }

    if (header.types?.["events"]) {
      result.events = header.types["events"]
    }

    if (header.types?.["params"]) {
      result.params = header.types["params"]
    }

    return Object.keys(result).length > 0 ? result : undefined
  }

  /**
   * Docs come from the typings frontmatter summary - XML bodies carry no doc
   * comments. Per-member prose lives in TSDoc inside the `props`/`events` type
   * text and is read by the analyzer through the TypeScript compiler, not here.
   */
  public override compileDocs(
    source: string,
    dimension: IDimension,
    options?: ICompilerOptions,
  ): IDocsEntry | undefined {
    const header = this.compileHeader(source)

    if (!header?.docs) {
      return undefined
    }

    const docs: IDocs = { ...parseDocComment(header.docs) }

    if (Object.keys(docs).length === 0) {
      return undefined
    }

    return { kind: this.kind, name: options?.name ?? "", dimension: dimension, docs }
  }

  protected compileElement(root: IXmlElement, dimension: IDimension, options: ICompilerOptions): IComponentDefinition {
    const name = options.name ?? ""
    const children = compileChildren(root.children)

    // `.hxm` components are always declarative: their body is the children.
    // Programmatic components are TypeScript classes, discovered and registered
    // separately - never declared through the template.
    if (children.length === 0) {
      throw new HeleonixComponentCompilerError(Errors.rootEmpty)
    }

    return {
      tag: name,
      dimension,
      children,
    }
  }
}

function compileChildren(nodes: IXmlNode[]): IComponentUsage[] {
  const result: IComponentUsage[] = []

  for (const node of nodes) {
    if (node.type === "text") {
      const raw = node.value.trim()

      if (!raw) {
        continue
      }

      result.push(createContentUsage(parseBinding(raw)))

      continue
    }

    result.push(compileUsage(node))
  }

  return result
}

function compileUsage(element: IXmlElement): IComponentUsage {
  const usage: IComponentUsage = {
    tag: element.tag,
  }

  const name = element.attributes[NAME_ATTRIBUTE]

  if (name) {
    usage.name = name
  }

  const overrides: IComponentOverride[] = []
  const properties = collectProperties(element, overrides)

  if (properties.length > 0) {
    usage.properties = properties
  }

  const children = compileElementChildren(element, overrides)

  if (children.length > 0) {
    usage.children = children
  }

  if (overrides.length > 0) {
    usage.overrides = overrides
  }

  return usage
}

function collectProperties(element: IXmlElement, overrides: IComponentOverride[]): IComponentProperty[] {
  const properties: IComponentProperty[] = []

  for (const attrName in element.attributes) {
    if (attrName === NAME_ATTRIBUTE) {
      continue
    }

    const raw = element.attributes[attrName]
    const target = getOverrideTarget(attrName)

    if (target !== undefined) {
      addOverride(overrides, element.tag, target, overrideFromValue(target, raw))

      continue
    }

    if (!isBindingExpression(raw)) {
      throw new HeleonixComponentCompilerError(Errors.invalidBinding, raw, attrName)
    }

    properties.push({ name: attrName, binding: parseBindingExpression(raw) })
  }

  return properties
}

function compileElementChildren(element: IXmlElement, overrides: IComponentOverride[]): IComponentUsage[] {
  const childElements: IXmlElement[] = []
  const textParts: string[] = []

  for (const child of element.children) {
    if (child.type === "element") {
      const target = getOverrideTarget(child.tag)

      if (target !== undefined) {
        addOverride(overrides, element.tag, target, overrideFromElement(target, child))

        continue
      }

      childElements.push(child)
    } else {
      const raw = child.value.trim()

      if (raw) {
        textParts.push(raw)
      }
    }
  }

  if (childElements.length > 0 && textParts.length > 0) {
    throw new HeleonixComponentCompilerError(Errors.mixedContent, element.tag)
  }

  if (textParts.length > 0) {
    return [createContentUsage(parseBinding(textParts.join(" ")))]
  }

  return childElements.map(compileUsage)
}

function overrideFromValue(target: string, raw: string): IComponentOverride {
  validateTarget(target)

  const value = raw.trim()

  if (value === "") {
    return { target }
  }

  if (!isBindingExpression(value)) {
    throw new HeleonixComponentCompilerError(Errors.invalidOverrideValue, target, raw)
  }

  return { target, binding: parseBindingExpression(value) }
}

function overrideFromElement(target: string, element: IXmlElement): IComponentOverride {
  validateTarget(target)

  for (const attrName in element.attributes) {
    if (Object.prototype.hasOwnProperty.call(element.attributes, attrName)) {
      throw new HeleonixComponentCompilerError(Errors.overrideAttributes, target)
    }
  }

  const children = compileChildren(element.children)
  const override: IComponentOverride = { target }

  if (children.length > 0) {
    override.children = children
  }

  return override
}

function addOverride(overrides: IComponentOverride[], tag: string, target: string, override: IComponentOverride): void {
  if (overrides.some((existing) => existing.target === target)) {
    throw new HeleonixComponentCompilerError(Errors.duplicateOverride, target, tag)
  }

  overrides.push(override)
}

function validateTarget(target: string): void {
  if (!OVERRIDE_TARGET.test(target)) {
    throw new HeleonixComponentCompilerError(Errors.invalidOverrideTarget, target)
  }
}

function parseBinding(raw: string): IBindingExpression {
  if (!isBindingExpression(raw)) {
    throw new HeleonixComponentCompilerError(Errors.invalidContent, raw)
  }

  return parseBindingExpression(raw)
}

function createContentUsage(binding: IBindingExpression): IComponentUsage {
  return {
    tag: CONTENT_TAG,
    name: CONTENT_NAME,
    properties: [{ name: VALUE_PROPERTY, binding }],
  }
}
