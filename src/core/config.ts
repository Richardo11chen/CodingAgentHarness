import { readFileSync, existsSync } from "node:fs"
import { parse } from "yaml"
import type { Config } from "./types.js"

export const DEFAULT_CONFIG: Config = {
  llm: { provider: "openai-compatible", model: "glm-5.2", baseURL: "https://njusehub.info/v1" },
  tools: ["file_read", "file_write", "file_delete", "shell_exec", "run_test"],
  policies: ".harness/policies.yml",
  sensors: { test: "npm test", lint: "npx eslint src/", typecheck: "npx tsc --noEmit" },
  sandbox: { timeout: 30, maxMemory: 512 },
  maxSteps: 50,
  timeout: 300,
}

export function loadConfig(path: string): Config {
  if (!existsSync(path)) {
    return { ...DEFAULT_CONFIG }
  }
  const raw = readFileSync(path, "utf-8")
  const parsed = parse(raw)
  return {
    llm: { ...DEFAULT_CONFIG.llm, ...parsed.llm },
    tools: parsed.tools ?? DEFAULT_CONFIG.tools,
    policies: parsed.policies ?? DEFAULT_CONFIG.policies,
    sensors: { ...DEFAULT_CONFIG.sensors, ...parsed.sensors },
    sandbox: { ...DEFAULT_CONFIG.sandbox, ...parsed.sandbox },
    maxSteps: parsed.maxSteps ?? DEFAULT_CONFIG.maxSteps,
    timeout: parsed.timeout ?? DEFAULT_CONFIG.timeout,
  }
}
