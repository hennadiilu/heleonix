/**
 * How an occurrence relates to its symbol. A `definition` is the declaration
 * site navigated to by Go To Definition (a component's `<Component>`/`<!--Name-->`,
 * a dictionary/config key, or the internal state read that declares a property);
 * a `reference` is any other use of the symbol (a `<Tag>` usage, a `@Name.entry`
 * / `#Name.entry` binding, a property set on a usage, an interpolated parameter).
 */
export type OccurrenceRole = "definition" | "reference"
