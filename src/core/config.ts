import { readFileSync, existsSync } from "node:fs"
import { parse } from "yaml"
import type { Config } from "./types.js"

export const DEFAULT_CONFIG: Config = {
  llm: { provider: "openai-compatible", model: "glm-5.2", baseURL: "https://njusehub.info/v1", thinking: false, reasoning_effort: "high" },
  tools: ["file_read", "file_write", "file_delete", "shell_exec", "run_test"],
  policies: ".harness/policies.yml",
  sensors: { test: "npm test", lint: "npx eslint src/", typecheck: "npx tsc --noEmit" },
  sandbox: { timeout: 30, maxMemory: 512 },
  maxSteps: 50,
  timeout: 300,
  providers: [
    { key: "openai", name: "OpenAI 兼容 (GLM)", baseURL: "https://njusehub.info/v1", model: "glm-5.2", thinking: false, reasoning_effort: "high" },
    { key: "deepseek-v4", name: "DeepSeek V4 Pro", baseURL: "https://api.deepseek.com", model: "deepseek-v4-pro", thinking: true, reasoning_effort: "high" },
    { key: "deepseek-flash", name: "DeepSeek V4 Flash", baseURL: "https://api.deepseek.com", model: "deepseek-v4-flash", thinking: false, reasoning_effort: "high" },
  ],
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
    policies: parsed.policies || DEFAULT_CONFIG.policies,
    sensors: { ...DEFAULT_CONFIG.sensors, ...parsed.sensors },
    sandbox: { ...DEFAULT_CONFIG.sandbox, ...parsed.sandbox },
    maxSteps: parsed.maxSteps ?? DEFAULT_CONFIG.maxSteps,
    timeout: parsed.timeout ?? DEFAULT_CONFIG.timeout,
    providers: parsed.providers ?? DEFAULT_CONFIG.providers,
  }
}
