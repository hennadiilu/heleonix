import { IErrorInfo } from "./IErrorInfo"

export const Errors = {
  // XML parser errors 0001-0099
  xmlUnexpectedEnd: {
    code: "HX_COMPILER_0001",
    ...(DEV && { message: "Unexpected end of input while parsing XML at position {0}." }),
  },
  xmlUnexpectedChar: {
    code: "HX_COMPILER_0002",
    ...(DEV && { message: "Unexpected character '{0}' at position {1}." }),
  },
  xmlUnclosedTag: {
    code: "HX_COMPILER_0003",
    ...(DEV && { message: "Unclosed tag '<{0}>' opened at position {1}." }),
  },
  xmlMismatchedTag: {
    code: "HX_COMPILER_0004",
    ...(DEV && { message: "Mismatched closing tag: expected '</{0}>', got '</{1}>' at position {2}." }),
  },
  xmlInvalidAttribute: {
    code: "HX_COMPILER_0005",
    ...(DEV && { message: "Invalid attribute syntax near position {0}." }),
  },
  xmlMultipleRoots: {
    code: "HX_COMPILER_0006",
    ...(DEV && { message: "Multiple root elements are not allowed at position {0}." }),
  },

  // JSONC parser errors 0050-0069
  jsoncUnexpectedEnd: {
    code: "HX_COMPILER_0050",
    ...(DEV && { message: "Unexpected end of input while parsing JSONC at position {0}." }),
  },
  jsoncUnexpectedChar: {
    code: "HX_COMPILER_0051",
    ...(DEV && { message: "Unexpected character '{0}' at position {1}." }),
  },
  jsoncInvalidNumber: {
    code: "HX_COMPILER_0052",
    ...(DEV && { message: "Invalid number literal '{0}' at position {1}." }),
  },
  jsoncInvalidString: {
    code: "HX_COMPILER_0053",
    ...(DEV && { message: "Invalid string literal at position {0}: {1}." }),
  },
  jsoncTrailingData: {
    code: "HX_COMPILER_0054",
    ...(DEV && { message: "Unexpected trailing content at position {0}." }),
  },

  // Frontmatter errors 0070-0079
  frontmatterUnterminated: {
    code: "HX_COMPILER_0070",
    ...(DEV && { message: "Unterminated frontmatter block; expected a closing '---' line." }),
  },
  frontmatterInvalidEntry: {
    code: "HX_COMPILER_0071",
    ...(DEV && { message: "Invalid frontmatter entry '{0}'; expected 'key: value'." }),
  },
  frontmatterBlockNested: {
    code: "HX_COMPILER_0072",
    ...(DEV && { message: "Invalid frontmatter block '{0}': blocks do not nest." }),
  },
  frontmatterBlockUnterminated: {
    code: "HX_COMPILER_0073",
    ...(DEV && { message: "Unterminated frontmatter block; expected a closing '}' line." }),
  },

  // Common compile errors 0100-0199
  emptySource: {
    code: "HX_COMPILER_0100",
    ...(DEV && { message: "Compiler received an empty source string." }),
  },
  rootElementMissing: {
    code: "HX_COMPILER_0101",
    ...(DEV && { message: "Expected root element '<{0}>' is missing." }),
  },
  invalidRootElement: {
    code: "HX_COMPILER_0102",
    ...(DEV && { message: "Expected root element '<{0}>', got '<{1}>'." }),
  },
} as const satisfies Record<string, IErrorInfo>
