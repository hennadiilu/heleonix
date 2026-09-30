import type { FQComponentName } from "@heleonix/hx-language"

export type BindingEndpointHandler = (fqComponentName: FQComponentName, localPath: string) => void
