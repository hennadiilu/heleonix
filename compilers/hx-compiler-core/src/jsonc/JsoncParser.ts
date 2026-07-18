import { parseJsonc } from "./parseJsonc"

/**
 * Strict JSONC parser for the build pipeline - a thin wrapper over the
 * error-tolerant {@link parseJsonc}.
 *
 * The build entry only needs the parsed value, so this returns it and discards
 * the flat-object `issues`: flatness is the `*.hxd` dictionary constraint, and
 * `*.hxc` configs may nest, so the dictionary compiler inspects `issues` itself
 * via {@link parseJsonc}. JSONC syntax errors are thrown by {@link parseJsonc} in
 * both paths. Keeping the walk in the shared function means the build and the
 * language server can never drift.
 */
export class JsoncParser {
  public parse(source: string): unknown {
    return parseJsonc(source).value
  }
}
