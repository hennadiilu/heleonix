import {
  BUILTIN_TAGS,
  COMPONENT_NAME_SEGMENT_SEPARATOR,
  NAME_ATTRIBUTE,
  REFERENCE_SEPARATORS,
  ReferenceType,
  ROOT_TAG,
  getOverrideTarget,
  isBindingExpression,
  parseBindingExpression,
} from "@heleonix/hx-language"
import { IXmlAttribute, IXmlScan, IXmlTag } from "@heleonix/hx-compiler-core"
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { DefinitionIndex } from "../../index/DefinitionIndex"
import { makeDiagnostic } from "../../lsp/makeDiagnostic"
import { definitionName } from "../jsonc/definitionName"
import { headSegment } from "../../references/headSegment"
import { inlineOverrideScopes, scopeOwnerAt } from "../../references/inlineOverrideScopes"
import { referenceIssue } from "../../references/resolveReference"
import { splitComponentPrefix } from "../../references/splitComponentPrefix"
import { COMPONENT_MESSAGES } from "./componentMessages"
import { currentComponents } from "./currentComponents"

/**
 * Validates `*.hxm` binding expressions (attribute values and text content) and
 * resolves their dictionary/config references against the index. `refSeverity`
 * is `undefined` when unresolved-reference reporting is turned off.
 *
 * It additionally checks, at the same severity:
 *   - state-binding values (`prop="some.state"`) against the property pool the
 *     file's component(s) receive at their usages, and
 *   - attribute names (`<Child prop.sub="...">`) against the property pool the
 *     target component reads internally,
 * both resolving any `ctrl:` / `ctrl.nested:` named-control prefix first.
 */
export function diagnoseComponent(
  doc: TextDocument,
  scan: IXmlScan,
  index: DefinitionIndex,
  refSeverity: DiagnosticSeverity | undefined,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const length = doc.getText().length
  const components = currentComponents(doc)
  const openTags: string[] = []

  // A state binding inside an inline `<target:Component>` override reads from that
  // override's own scope, not the enclosing component (see inlineOverrideScopes).
  const scopes = inlineOverrideScopes(scan, definitionName(doc.uri))
  const bindingComponents = (offset: number): readonly string[] => {
    const owner = scopeOwnerAt(offset, scopes)

    return owner ? [owner] : components
  }

  for (const tag of scan.tags) {
    if (tag.closing) {
      openTags.pop()
      continue
    }

    // An inline `<target:Component>` override: validate the target against the
    // enclosing usage's definition rather than treating it as a component tag.
    const inlineTarget = getOverrideTarget(tag.name)

    if (inlineTarget !== undefined) {
      validateInlineOverride(doc, tag, inlineTarget, openTags[openTags.length - 1], index, refSeverity, diagnostics)

      if (!tag.selfClosing) {
        openTags.push(tag.name)
      }

      continue
    }

    for (const attr of tag.attrs) {
      const overrideTarget = attr.name ? getOverrideTarget(attr.name) : undefined

      if (overrideTarget !== undefined) {
        validateOverrideAttribute(doc, tag.name, overrideTarget, attr, length, index, refSeverity, diagnostics)
        continue
      }

      if (attr.name && attr.name !== NAME_ATTRIBUTE) {
        validatePropertyName(doc, tag.name, attr.name, attr.nameStart, attr.nameEnd, index, refSeverity, diagnostics)
      }

      if (attr.name === NAME_ATTRIBUTE || attr.value === undefined || attr.valueStart === undefined) {
        continue
      }

      if (attr.unterminated) {
        diagnostics.push(
          error(doc, attr.valueStart, attr.valueEnd ?? length, COMPONENT_MESSAGES.unterminatedAttributeValue),
        )
        continue
      }

      if (attr.value !== "") {
        validateBinding(
          doc,
          attr.value,
          attr.valueStart,
          attr.valueEnd ?? attr.valueStart,
          bindingComponents(attr.valueStart),
          index,
          refSeverity,
          diagnostics,
        )
      }
    }

    if (!tag.selfClosing) {
      openTags.push(tag.name)
    }
  }

  for (const node of scan.texts) {
    validateBinding(
      doc,
      node.value.trim(),
      node.start,
      node.end,
      bindingComponents(node.start),
      index,
      refSeverity,
      diagnostics,
    )
  }

  return diagnostics
}

function validateBinding(
  doc: TextDocument,
  raw: string,
  start: number,
  end: number,
  components: readonly string[],
  index: DefinitionIndex,
  refSeverity: DiagnosticSeverity | undefined,
  out: Diagnostic[],
): void {
  if (!raw) {
    return
  }

  if (!isBindingExpression(raw)) {
    out.push(error(doc, start, end, COMPONENT_MESSAGES.invalidBindingExpression(raw)))
    return
  }

  const expression = parseBindingExpression(raw)

  if (expression.type === "dictionary") {
    resolveRef(doc, expression.value, start, end, "dictionary", index, refSeverity, out)
  } else if (expression.type === "config") {
    resolveRef(doc, expression.value, start, end, "config", index, refSeverity, out)
  } else {
    validateStateValue(doc, expression.value, start, end, components, index, refSeverity, out)
  }
}

/**
 * A state-binding value reads a property of the component(s) defined in this
 * file (or of a named control of one of them, when `ctrl:`-qualified). The
 * readable pool is what callers set on that component across the workspace
 * ({@link DefinitionIndex.incomingProperties}); when the pool is empty there is
 * no evidence to validate against, so it is left alone.
 */
function validateStateValue(
  doc: TextDocument,
  value: string,
  start: number,
  end: number,
  components: readonly string[],
  index: DefinitionIndex,
  severity: DiagnosticSeverity | undefined,
  out: Diagnostic[],
): void {
  if (severity === undefined) {
    return
  }

  const { prefix, path } = splitComponentPrefix(value)
  const head = headSegment(path)

  if (!head) {
    return
  }

  const targets = resolveTargets(components, prefix, index)

  if (!targets) {
    out.push(makeDiagnostic(doc, start, end, COMPONENT_MESSAGES.unknownComponent(prefix), severity))
    return
  }

  const pool = poolOf(targets, (component) => index.incomingProperties(component))

  if (pool.length === 0 || pool.some((property) => headSegment(property) === head)) {
    return
  }

  const message = prefix
    ? COMPONENT_MESSAGES.unknownComponentProperty(prefix, path)
    : COMPONENT_MESSAGES.unknownStateProperty(path)
  out.push(makeDiagnostic(doc, start, end, message, severity))
}

/**
 * An attribute name sets a property on the component being used (or on a named
 * control of it, when `ctrl:`-qualified). The settable pool is what that
 * component reads internally, directly or through the `{param}`s of the
 * dictionary entries it references ({@link DefinitionIndex.consumedProperties}).
 * Since indexing sees a component's whole definition, an empty pool is positive
 * evidence that nothing is settable. Tags the index doesn't know are checked
 * against the platform's component data (HTML attributes per W3C/MDN) instead.
 */
function validatePropertyName(
  doc: TextDocument,
  tagName: string,
  attrName: string,
  start: number,
  end: number,
  index: DefinitionIndex,
  severity: DiagnosticSeverity | undefined,
  out: Diagnostic[],
): void {
  if (severity === undefined || tagName === ROOT_TAG || BUILTIN_TAGS.has(tagName)) {
    return
  }

  // Native/unknown tags are validated by the shared analyzer (an open
  // component's known attributes are value-checked, the rest allowed).
  if (!index.isComponent(tagName)) {
    return
  }

  const { prefix, path } = splitComponentPrefix(attrName)
  const head = headSegment(path)

  if (!head) {
    return
  }

  const targets = resolveTargets([tagName], prefix, index)

  if (!targets) {
    out.push(makeDiagnostic(doc, start, end, COMPONENT_MESSAGES.unknownComponent(prefix), severity))
    return
  }

  for (const target of targets) {
    if (!index.isComponent(target)) {
      return
    }
  }

  const pool = poolOf(targets, (component) => index.consumedProperties(component))

  if (pool.some((property) => headSegment(property) === head)) {
    return
  }

  const message = prefix
    ? COMPONENT_MESSAGES.unknownComponentProperty(prefix, path)
    : COMPONENT_MESSAGES.unknownProperty(tagName, path)
  out.push(makeDiagnostic(doc, start, end, message, severity))
}

/**
 * Validates a `target:Component` override attribute: the target chain against
 * the used component's definition and the value (empty, a known component, or a
 * dictionary/config reference).
 */
function validateOverrideAttribute(
  doc: TextDocument,
  tagName: string,
  target: string,
  attr: IXmlAttribute,
  length: number,
  index: DefinitionIndex,
  severity: DiagnosticSeverity | undefined,
  out: Diagnostic[],
): void {
  validateOverrideTarget(doc, tagName, target, attr.nameStart, attr.nameEnd, index, severity, out)

  if (attr.value === undefined || attr.valueStart === undefined) {
    return
  }

  if (attr.unterminated) {
    out.push(error(doc, attr.valueStart, attr.valueEnd ?? length, COMPONENT_MESSAGES.unterminatedAttributeValue))
    return
  }

  validateOverrideValue(doc, attr.value, attr.valueStart, attr.valueEnd ?? attr.valueStart, index, severity, out)
}

/**
 * Validates an inline `<target:Component>` override element: it must sit inside
 * a component usage, carry no attributes, and name a valid target of that usage.
 */
function validateInlineOverride(
  doc: TextDocument,
  tag: IXmlTag,
  target: string,
  hostTag: string | undefined,
  index: DefinitionIndex,
  severity: DiagnosticSeverity | undefined,
  out: Diagnostic[],
): void {
  for (const attr of tag.attrs) {
    if (attr.name) {
      out.push(error(doc, attr.nameStart, attr.nameEnd, COMPONENT_MESSAGES.overrideTagAttributes))
      break
    }
  }

  if (hostTag === undefined || hostTag === ROOT_TAG) {
    out.push(error(doc, tag.nameStart, tag.nameEnd, COMPONENT_MESSAGES.overrideTagWithoutHost))
    return
  }

  validateOverrideTarget(doc, hostTag, target, tag.nameStart, tag.nameEnd, index, severity, out)
}

/**
 * Resolves an override target chain inside `tagName`'s definition. Only real
 * components are checked - the internals of HTML/builtin tags are unknown, so a
 * target on one is left alone (mirrors {@link validatePropertyName}).
 */
function validateOverrideTarget(
  doc: TextDocument,
  tagName: string,
  target: string,
  start: number,
  end: number,
  index: DefinitionIndex,
  severity: DiagnosticSeverity | undefined,
  out: Diagnostic[],
): void {
  if (severity === undefined || tagName === ROOT_TAG || BUILTIN_TAGS.has(tagName) || !index.isComponent(tagName)) {
    return
  }

  const segments = target.split(COMPONENT_NAME_SEGMENT_SEPARATOR).filter(Boolean)

  if (segments.length === 0) {
    return
  }

  const result = index.resolveOverrideChain([tagName], segments)

  if (result.status === "ambiguous") {
    out.push(
      makeDiagnostic(doc, start, end, COMPONENT_MESSAGES.ambiguousOverrideTarget(result.segment, tagName), severity),
    )
  } else if (result.status === "unknown") {
    out.push(makeDiagnostic(doc, start, end, COMPONENT_MESSAGES.unknownOverrideTarget(target, tagName), severity))
  }
}

/**
 * Validates a `target:Component` value: empty renders nothing; `@Dic.entry` /
 * `#Cfg.entry` resolves like any reference; a PascalCase bare name must be a
 * known component (a lowercase bare name is assumed to be a platform tag).
 */
function validateOverrideValue(
  doc: TextDocument,
  raw: string,
  start: number,
  end: number,
  index: DefinitionIndex,
  severity: DiagnosticSeverity | undefined,
  out: Diagnostic[],
): void {
  const value = raw.trim()

  if (!value) {
    return
  }

  if (!isBindingExpression(value)) {
    out.push(error(doc, start, end, COMPONENT_MESSAGES.invalidBindingExpression(value)))
    return
  }

  const expression = parseBindingExpression(value)

  if (expression.type === "dictionary") {
    resolveRef(doc, expression.value, start, end, "dictionary", index, severity, out)
    return
  }

  if (expression.type === "config") {
    resolveRef(doc, expression.value, start, end, "config", index, severity, out)
    return
  }

  if (severity !== undefined && /^[A-Z]/.test(expression.value) && !index.isComponent(expression.value)) {
    out.push(makeDiagnostic(doc, start, end, COMPONENT_MESSAGES.unknownOverrideComponent(expression.value), severity))
  }
}

/** Components a `ctrl.nested:` prefix resolves to from `starts`, or `undefined` when it names no known control. */
function resolveTargets(starts: readonly string[], prefix: string, index: DefinitionIndex): Set<string> | undefined {
  if (!prefix) {
    return new Set(starts)
  }

  const segments = prefix.split(COMPONENT_NAME_SEGMENT_SEPARATOR).filter(Boolean)
  const targets = index.resolveControlChain(starts, segments)

  return targets.size === 0 ? undefined : targets
}

function poolOf(components: Iterable<string>, propertiesOf: (component: string) => readonly string[]): string[] {
  const pool: string[] = []

  for (const component of components) {
    pool.push(...propertiesOf(component))
  }

  return pool
}

function resolveRef(
  doc: TextDocument,
  ref: string,
  start: number,
  end: number,
  kind: ReferenceType,
  index: DefinitionIndex,
  refSeverity: DiagnosticSeverity | undefined,
  out: Diagnostic[],
): void {
  if (refSeverity === undefined) {
    return
  }

  const split = ref.lastIndexOf(REFERENCE_SEPARATORS[kind])

  if (split <= 0) {
    return
  }

  const message = referenceIssue(kind, ref.slice(0, split), ref.slice(split + 1), index)

  if (message) {
    out.push(makeDiagnostic(doc, start, end, message, refSeverity))
  }
}

function error(doc: TextDocument, start: number, end: number, message: string): Diagnostic {
  return makeDiagnostic(doc, start, end, message, DiagnosticSeverity.Error)
}
