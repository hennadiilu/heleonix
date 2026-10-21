// Qualifiers reached through native CSS spelling, never written as `@hx-*`:
// `@media` compiles to `Media`, and `Pseudo` handles every `:pseudo-class` and
// `::pseudo-element` (each compiles to its own name, which falls back to it).
export const NATIVE_QUALIFIERS: ReadonlySet<string> = new Set(["Media", "Pseudo"])
