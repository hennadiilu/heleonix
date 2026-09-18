import type { FQComponentName } from "@heleonix/hx-language"

export type BindingEndpointHandler = (componentFQ: FQComponentName, localPath: string) => void
