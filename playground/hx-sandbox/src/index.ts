import { SandboxApplication } from "./SandboxApplication"

const application = new SandboxApplication()
await application.run()

//-----------------------------

// const componentCompiler = new ComponentCompiler()

// const source = `
// <Component>
//   <div>
//     <h1>Hello</h1>
//   </div>
// </Component>
// `
// const dimension = { culture: "en-US", customer: "customer2", env: "test" }
// const component = await componentCompiler.compile(source, dimension, { name: "CustomAddButton" })
// console.log(component)
