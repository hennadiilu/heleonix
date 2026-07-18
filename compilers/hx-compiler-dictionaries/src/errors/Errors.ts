import type { IErrorInfo } from "@heleonix/hx-compiler-core"

export const Errors = {
  invalidRoot: {
    code: "HX_COMPILER_0201",
    ...(DEV && { message: "Invalid dictionary: the document root must be a JSON object." }),
  },
  invalidEntry: {
    code: "HX_COMPILER_0200",
    ...(DEV && { message: "Invalid dictionary entry '{0}': value must be a string." }),
  },
} as const satisfies Record<string, IErrorInfo>
