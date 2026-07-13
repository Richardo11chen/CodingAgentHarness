import { createHarnessServer } from "./web/server.js"
import { DEFAULT_CONFIG } from "./core/config.js"

const config = DEFAULT_CONFIG
createHarnessServer({ llm: undefined as any, config, projectDir: process.cwd() })
  .then(({ server, port }) => {
    console.log(`Coding Agent Harness running on http://localhost:${port}`)
  })
  .catch(console.error)
