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

  // Configuration errors 0600-0699
  invalidConfig: {
    code: "HX_PLUGIN_0600",
    ...(DEV && { message: "Invalid configuration '{0}': {1}" }),
  },
  configExtendsCycle: {
    code: "HX_PLUGIN_0601",
    ...(DEV && { message: "Configuration extends itself: {0}." }),
  },
  configNotFound: {
    code: "HX_PLUGIN_0602",
    ...(DEV && { message: "Configuration '{0}' extended by '{1}' was not found." }),
  },
} as const satisfies Record<string, IErrorInfo>
