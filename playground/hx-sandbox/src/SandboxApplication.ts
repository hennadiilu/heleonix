import { Application } from "@heleonix/hx-core"
import {
  WebComponentDefinitionSource,
  WebPlatformAdapter,
  WebPlatformComponent,
  WebPlatformRuntime,
} from "@heleonix/hx-platform-web"
import { CompiledComponentDefinitionSource } from "hx-compiled-components"
import { CompiledDictionaryDefinitionSource } from "hx-compiled-dictionaries"
import { CompiledConfigDefinitionSource } from "hx-compiled-configs"
import dimensions from "../hx.dimensions.json"

export class SandboxApplication extends Application {
  public constructor() {
    super("SandboxApplication", {
      dimensions,
      componentDefinition: {
        sources: [CompiledComponentDefinitionSource, WebComponentDefinitionSource],
      },
      dictionaryDefinition: {
        sources: [CompiledDictionaryDefinitionSource],
      },
      configDefinition: {
        sources: [CompiledConfigDefinitionSource],
      },
      platform: {
        adapter: WebPlatformAdapter,
        runtime: WebPlatformRuntime,
      },
      components: [WebPlatformComponent],
    })
  }

  public override async run(): Promise<void> {
    this.dimensionManager.updateDimension({ env: "dev", customer: "customer1", culture: "en-US" })

    await super.run()
  }
}
