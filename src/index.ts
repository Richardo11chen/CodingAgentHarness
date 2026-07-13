import "dotenv/config"
import { createHarnessServer } from "./web/server.js"
import { DEFAULT_CONFIG, loadConfig } from "./core/config.js"
import { RealLLMProvider } from "./core/llm.js"
import { KeychainStore } from "./credentials/keychain.js"
import { EnvStore } from "./credentials/env.js"
import { existsSync } from "node:fs"
import { join } from "node:path"

async function getApiKey(): Promise<string | null> {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY

  try {
    const keychain = new KeychainStore("coding-agent-harness")
    if (await keychain.hasKey("api_key")) return await keychain.get("api_key")
  } catch {
    // keytar not available (e.g. Docker), fall through to env store
  }

  const envPath = join(process.cwd(), ".harness", ".env")
  if (existsSync(envPath)) {
    const envStore = new EnvStore(envPath)
    if (await envStore.hasKey("API_KEY")) return await envStore.get("API_KEY")
  }

  return null
}

async function main() {
  const configPath = join(process.cwd(), ".harness", "config.yml")
  const config = existsSync(configPath) ? loadConfig(configPath) : DEFAULT_CONFIG

  const apiKey = await getApiKey()

  const llm = apiKey
    ? new RealLLMProvider({
        baseURL: config.llm.baseURL,
        model: config.llm.model,
        apiKey,
      })
    : undefined as any

  const { port } = await createHarnessServer({ llm, config, projectDir: process.cwd() })
  console.log(`Coding Agent Harness running on http://localhost:${port}`)
  if (!apiKey) {
    console.warn("WARNING: No API key found. Set OPENAI_API_KEY env var or configure via WebUI.")
  }
}

main().catch(console.error)
