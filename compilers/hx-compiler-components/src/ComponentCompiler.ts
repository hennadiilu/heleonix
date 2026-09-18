import {
  XmlCompiler,
  ICompilerOptions,
  IXmlAttributeValue,
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
  soleExpression,
  stringLiteralExpression,
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
const TRUE_LITERAL = "true"

const OVERRIDE_TARGET = new RegExp(
  `^${IDENTIFIER_PATTERN}(\\${COMPONENT_NAME_SEGMENT_SEPARATOR}${IDENTIFIER_PATTERN})*$`,
)

export class ComponentCompiler extends XmlCompiler<IComponentDefinition> {
  protected get rootTag(): string {
    return ROOT_TAG
  }

  protected get kind(): Kind {
    return "component"
  }

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

      result.push(createContentUsage(contentBinding(raw)))

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
    if (name.kind !== "literal") {
      throw new HeleonixComponentCompilerError(Errors.invalidName, element.tag)
    }

    if (name.value) {
      usage.name = name.value
    }
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

    const attribute = element.attributes[attrName]
    const target = getOverrideTarget(attrName)

    if (target !== undefined) {
      addOverride(overrides, element.tag, target, overrideFromValue(target, attribute))

      continue
    }

    properties.push({ name: attrName, binding: attributeBinding(attrName, attribute) })
  }

  return properties
}

function attributeBinding(name: string, attribute: IXmlAttributeValue): IBindingExpression {
  if (attribute.kind === "flag") {
    return parseBindingExpression(TRUE_LITERAL)
  }

  if (attribute.kind === "literal") {
    return stringLiteralExpression(attribute.value)
  }

  const expression = attribute.value.trim()

  if (!isBindingExpression(expression)) {
    throw new HeleonixComponentCompilerError(Errors.invalidBinding, attribute.value, name)
  }

  return parseBindingExpression(expression)
}

function contentBinding(raw: string): IBindingExpression {
  const expression = soleExpression(raw)

  if (expression === undefined) {
    return stringLiteralExpression(raw)
  }

  const trimmed = expression.text.trim()

  if (!isBindingExpression(trimmed)) {
    throw new HeleonixComponentCompilerError(Errors.invalidContent, raw)
  }

  return parseBindingExpression(trimmed)
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
    return [createContentUsage(contentBinding(textParts.join(" ")))]
  }

  return childElements.map(compileUsage)
}

function overrideFromValue(target: string, attribute: IXmlAttributeValue): IComponentOverride {
  validateTarget(target)

  if (attribute.kind === "flag") {
    return { target }
  }

  const value = attribute.value.trim()

  if (value === "") {
    return { target }
  }

  if (attribute.kind === "literal") {
    return { target, binding: stringLiteralExpression(value) }
  }

  if (!isBindingExpression(value)) {
    throw new HeleonixComponentCompilerError(Errors.invalidOverrideValue, target, attribute.value)
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

function createContentUsage(binding: IBindingExpression): IComponentUsage {
  return {
    tag: CONTENT_TAG,
    name: CONTENT_NAME,
    properties: [{ name: VALUE_PROPERTY, binding }],
  }
}
