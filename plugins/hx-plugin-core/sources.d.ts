declare module "*.hxm" {
  const definition: import("@heleonix/hx-language").IComponentDefinition
  export default definition
}

declare module "*.hxd" {
  const definition: import("@heleonix/hx-language").IDictionaryDefinition
  export default definition
}

declare module "*.hxc" {
  const definition: import("@heleonix/hx-language").IConfigDefinition
  export default definition
}

declare module "*.hxs" {
  const definition: import("@heleonix/hx-language").IStyleDefinition
  export default definition
}

declare module "*.hxt" {
  const definition: import("@heleonix/hx-language").IThemeDefinition
  export default definition
}
