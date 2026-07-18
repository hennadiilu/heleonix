import type { IErrorInfo } from "@heleonix/hx-plugin-core"

export const Errors = {
  // Loader errors 0200-0299
  loaderFailure: {
    code: "HX_PLUGIN_0200",
    ...(DEV && { message: "Failed to process Heleonix source '{0}': {1}." }),
  },
  skippedDirectImport: {
    code: "HX_PLUGIN_0201",
    ...(DEV && {
      message:
        "Ignored direct import of '{0}': dimension value '{1}' is not among the application's " +
        "configured dimensions, so the import resolves to null.",
    }),
  },

  // Asset emission errors 0400-0499
  emitFailure: {
    code: "HX_PLUGIN_0400",
    ...(DEV && { message: "Failed to emit compiled Heleonix asset for '{0}': {1}." }),
  },
} as const satisfies Record<string, IErrorInfo>
