import Jasmine from "jasmine"

const jasmine = new Jasmine()

jasmine.loadConfigFile(new URL("./support/jasmine.json", import.meta.url).pathname.slice(1))

await jasmine.execute()
