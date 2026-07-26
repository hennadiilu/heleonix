/**
 * The provider a qualifier argument's value completion/validation routes to,
 * derived from its branded TypeScript type: `PropertyRef` -> `property` (state
 * pool), `EventRef` -> `event` (component events), `ThemeTokenRef` -> `theme`
 * (theme token space).
 */
export type QualifierRefKind = "property" | "event" | "theme"
