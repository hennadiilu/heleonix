import type { IErrorInfo } from "@heleonix/hx-compiler-core"

export const Errors = {
  invalidRoot: {
    code: "HX_COMPILER_0300",
    ...(DEV && { message: "Invalid config: the document root must be a JSON object." }),
  },
} as const satisfies Record<string, IErrorInfo>
