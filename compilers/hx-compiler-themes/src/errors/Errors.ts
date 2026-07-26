import type { IErrorInfo } from "@heleonix/hx-compiler-core"

export const Errors = {
  unsupportedAtRule: {
    code: "HX_COMPILER_0700",
    ...(DEV && {
      message:
        "Unsupported at-rule '@{0}' in a theme; only '@keyframes', '@font-face' and '@counter-style' are allowed.",
    }),
  },
  unexpectedBlock: {
    code: "HX_COMPILER_0701",
    ...(DEV && { message: "Unexpected block '{0}' in a theme; theme blocks are token groups or '@'-artifacts." }),
  },
  duplicateToken: {
    code: "HX_COMPILER_0702",
    ...(DEV && {
      message: "Duplicate theme token '{0}': a token or group with this name already exists in this scope.",
    }),
  },
  duplicateArtifact: {
    code: "HX_COMPILER_0703",
    ...(DEV && { message: "Duplicate theme '@{0}' artifact named '{1}'." }),
  },
  unexpectedStatement: {
    code: "HX_COMPILER_0704",
    ...(DEV && { message: "Unexpected statement '{0}' in a theme." }),
  },
} as const satisfies Record<string, IErrorInfo>
