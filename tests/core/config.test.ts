import { describe, it, expect } from "vitest"
import { loadConfig, DEFAULT_CONFIG } from "../../src/core/config"
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

describe("loadConfig", () => {
  it("loads config from YAML", () => {
    const path = join(tmpdir(), "test-config.yml")
    writeFileSync(path, `
llm:
  provider: "test"
  model: "test-model"
  baseURL: "http://localhost:8080"
tools: [file_read]
policies: "policies.yml"
sensors:
  test: "npm test"
  lint: "eslint ."
  typecheck: "tsc --noEmit"
sandbox:
  timeout: 10
  maxMemory: 256
maxSteps: 20
timeout: 60
`)
    const config = loadConfig(path)
    expect(config.llm.model).toBe("test-model")
    expect(config.maxSteps).toBe(20)
  })

  it("returns defaults when file missing", () => {
    const config = loadConfig("/nonexistent/path.yml")
    expect(config.maxSteps).toBe(DEFAULT_CONFIG.maxSteps)
    expect(config.llm.provider).toBe(DEFAULT_CONFIG.llm.provider)
  })
})
