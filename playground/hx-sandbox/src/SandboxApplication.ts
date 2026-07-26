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
import { CompiledStyleDefinitionSource } from "hx-compiled-styles"
import { CompiledThemeDefinitionSource } from "hx-compiled-themes"
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
      styleDefinition: {
        sources: [CompiledStyleDefinitionSource],
      },
      themeDefinition: {
        sources: [CompiledThemeDefinitionSource],
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
