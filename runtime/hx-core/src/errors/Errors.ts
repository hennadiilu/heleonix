import { IErrorInfo } from "./IErrorInfo"

export const Errors = {
  // Common errors 0001-0099
  unknownComponent: {
    code: "HX_CORE_0001",
    ...(DEV && { message: "The '{0}' component is unknown (probably it was not provided)." }),
  },

  duplicateHxName: {
    code: "HX_CORE_0002",
    ...(DEV && {
      message:
        "Two classes are registered under the name '{0}'. A subclass inherits its base's static hxName - declare its own.",
    }),
  },

  // Application errors 0100-0199
  applicationLifecycle: {
    code: "HX_CORE_0100",
    ...(DEV && { message: "The application failed to process stage '{0}' due to: {1}." }),
  },
  noRootElement: {
    code: "HX_CORE_0101",
    ...(DEV && { message: "The root element of the application was not found in the DOM by the selector: '{0}'." }),
  },

  // Component errors 0200-0299
  componentCreation: {
    code: "HX_CORE_0200",
    ...(DEV && { message: "Could not create a component: '{0}'." }),
  },
  componentBuild: {
    code: "HX_CORE_0201",
    ...(DEV && { message: "Could not build a component: '{0}'." }),
  },
  componentUpdate: {
    code: "HX_CORE_0202",
    ...(DEV && { message: "Could not update a component: '{0}'." }),
  },
  definitionRetrieval: {
    code: "HX_CORE_0203",
    ...(DEV && { message: "Could not retrieve definition for component: '{0}' because of: {1}." }),
  },
  invalidOverrideComponent: {
    code: "HX_CORE_0204",
    ...(DEV && { message: "Component override resolved to an unknown component: '{0}' (for target '{1}')." }),
  },

  // Dictionary errors 0300-0399
  dictionaryDefinitionProviding: {
    code: "HX_CORE_0300",
    ...(DEV && { message: "Could not provide definition for dictionary: '{0}'." }),
  },
  dictionaryEntryRetrieval: {
    code: "HX_CORE_0301",
    ...(DEV && { message: "Could not find a dictionary entry: '{0}'." }),
  },

  // Config errors 0400-0499
  configDefinitionProviding: {
    code: "HX_CORE_0400",
    ...(DEV && { message: "Could not provide definition for config: '{0}'." }),
  },
  configEntryRetrieval: {
    code: "HX_CORE_0401",
    ...(DEV && { message: "Could not find a config entry: '{0}'." }),
  },

  // Binding errors 0500-0599
  unknownConverter: {
    code: "HX_CORE_0500",
    ...(DEV && { message: "The '{0}' converter is unknown (probably it was not provided)." }),
  },

  // Scheduler errors 0600-0699
  schedulerJob: {
    code: "HX_CORE_0600",
    ...(DEV && { message: "A scheduled '{0}' job failed due to: {1}." }),
  },

  // Action errors 0700-0799
  unknownAction: {
    code: "HX_CORE_0700",
    ...(DEV && { message: "The '{0}' action is unknown (probably it was not provided)." }),
  },

  // Service errors 0800-0899
  unknownService: {
    code: "HX_CORE_0800",
    ...(DEV && { message: "The '{0}' service is unknown (probably it was not provided)." }),
  },
  circularServiceDependency: {
    code: "HX_CORE_0801",
    ...(DEV && { message: "The '{0}' service depends on itself through its own constructor." }),
  },

  // Dimension errors 0900-0999
  unknownDimension: {
    code: "HX_CORE_0900",
    ...(DEV && { message: "The '{0}' dimension is not declared. Declared dimensions: {1}." }),
  },
  invalidDimensionValue: {
    code: "HX_CORE_0901",
    ...(DEV && { message: "The '{0}' value is not declared for the '{1}' dimension. Declared values: {2}." }),
  },
} as const satisfies Record<string, IErrorInfo>
