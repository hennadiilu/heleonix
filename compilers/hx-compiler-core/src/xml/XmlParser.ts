import { Errors } from "../errors/Errors"
import { HeleonixCompilerError } from "../errors/HeleonixCompilerError"
import { IXmlElement } from "./IXmlElement"
import { parseXml } from "./parseXml"

/**
 * Strict XML parser for the build pipeline - a thin wrapper over the
 * error-tolerant {@link parseXml}.
 *
 * Where editor tooling consumes {@link scanXml}/{@link parseXml} and tolerates a
 * non-empty error list, the compiler must fail fast: this raises the first
 * collected error as a {@link HeleonixCompilerError} (preserving its source
 * offset) and otherwise returns the assembled tree. Keeping the grammar in the
 * shared lexer means the build and the language server can never drift.
 */
export class XmlParser {
  public parse(source: string): IXmlElement {
    const { root, errors } = parseXml(source)

    if (errors.length > 0) {
      const first = errors[0]
      const error = new HeleonixCompilerError(first.info, ...first.args)
      error.offset = first.offset

      throw error
    }

    if (!root) {
      throw new HeleonixCompilerError(Errors.xmlUnexpectedEnd, String(source.length))
    }

    return root
  }
}
