import type { IErrorInfo } from "@heleonix/hx-compiler-core"

export const Errors = {
  invalidBinding: {
    code: "HX_COMPILER_0400",
    ...(DEV && { message: "Invalid binding expression '{0}' on attribute '{1}'." }),
  },
  invalidContent: {
    code: "HX_COMPILER_0401",
    ...(DEV && { message: "Component content must be a component or a binding expression, got '{0}'." }),
  },
  mixedContent: {
    code: "HX_COMPILER_0402",
    ...(DEV && { message: "Element '<{0}>' cannot mix component children with binding text content." }),
  },
  invalidOverrideValue: {
    code: "HX_COMPILER_0403",
    ...(DEV && {
      message:
        "Component override '{0}:Component' must be empty, a component name, or a dictionary/config reference, got '{1}'.",
    }),
  },
  invalidOverrideTarget: {
    code: "HX_COMPILER_0404",
    ...(DEV && { message: "Component override target '{0}' is not a valid control/component chain." }),
  },
  duplicateOverride: {
    code: "HX_COMPILER_0405",
    ...(DEV && { message: "Component override for target '{0}' is declared more than once on '<{1}>'." }),
  },
  overrideAttributes: {
    code: "HX_COMPILER_0406",
    ...(DEV && { message: "Inline component override '<{0}:Component>' cannot have attributes." }),
  },
} as const satisfies Record<string, IErrorInfo>
