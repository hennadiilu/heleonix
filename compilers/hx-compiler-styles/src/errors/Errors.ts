import type { IErrorInfo } from "@heleonix/hx-compiler-core"

export const Errors = {
  unsupportedAtRule: {
    code: "HX_COMPILER_0600",
    ...(DEV && {
      message: "Unsupported at-rule '@{0}' in a style; only '@media', '@keyframes' and '@hx-*' qualifiers are allowed.",
    }),
  },
  unexpectedBlock: {
    code: "HX_COMPILER_0601",
    ...(DEV && { message: "Unexpected block '{0}' in a style; a style has no bare-identifier groups." }),
  },
  multiplePseudoElements: {
    code: "HX_COMPILER_0602",
    ...(DEV && { message: "A style rule may contain at most one pseudo-element; found '{0}' with '{1}' already set." }),
  },
} as const satisfies Record<string, IErrorInfo>
