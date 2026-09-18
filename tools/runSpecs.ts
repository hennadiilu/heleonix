import Jasmine from "jasmine"
;(globalThis as { DEV?: boolean }).DEV = true

const jasmine = new Jasmine()

jasmine.loadConfig({ spec_dir: "spec", spec_files: ["**/*.spec.ts"] })

await jasmine.execute()
