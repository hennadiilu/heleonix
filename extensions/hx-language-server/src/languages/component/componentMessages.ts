/** Diagnostic message templates for `ComponentLanguageService`. */
export const COMPONENT_MESSAGES = {
  unterminatedAttributeValue: "Unterminated attribute value.",
  invalidBindingExpression: (raw: string) => `Invalid binding expression: '${raw}'.`,
  unknownComponent: (name: string) => `Component '${name}' is not declared in this component.`,
  unknownComponentProperty: (componentName: string, property: string) =>
    `Property '${property}' is not available on component '${componentName}'.`,
  unknownStateProperty: (property: string) =>
    `'${property}' is not a property set on this component at any of its usages.`,
  unknownProperty: (tag: string, property: string) => `Property '${property}' is not used by component '${tag}'.`,
  unknownOverrideTarget: (target: string, tag: string) =>
    `Override target '${target}' does not name a control or component in '${tag}'.`,
  ambiguousOverrideTarget: (segment: string, tag: string) =>
    `Override target '${segment}' is ambiguous in '${tag}': it names both a control and a component.`,
  unknownOverrideComponent: (name: string) => `Component override '${name}' is not a known component.`,
  overrideTagAttributes: "An inline component override cannot have attributes.",
  overrideTagWithoutHost: "An inline component override must be a child of a component usage.",
} as const
