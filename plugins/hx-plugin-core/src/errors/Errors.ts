import type { IErrorInfo } from "./IErrorInfo"

export const Errors = {
  // Asset file name parsing errors 0001-0099
  ambiguousDimensionValue: {
    code: "HX_PLUGIN_0001",
    ...(DEV && { message: "Ambiguous dimension value '{0}' in '{1}'; it matches dimensions: {2}." }),
  },
  duplicateDimension: {
    code: "HX_PLUGIN_0002",
    ...(DEV && { message: "Duplicate value for dimension '{0}' in '{1}'." }),
  },

  // Compilation errors 0100-0199
  unsupportedExtension: {
    code: "HX_PLUGIN_0100",
    ...(DEV && { message: "Unsupported source extension '{0}'." }),
  },

  // Scan errors 0300-0399
  includeDirNotFound: {
    code: "HX_PLUGIN_0300",
    ...(DEV && { message: "Include directory '{0}' does not exist." }),
  },
} as const satisfies Record<string, IErrorInfo>
