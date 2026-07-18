export interface IHxDefinitionSourceOptions {
  /** Name of the generated class (also used as its `diName`). */
  className?: string
  /** Bare specifier the app imports the generated class from (wired via a resolve alias). */
  moduleName?: string
}
