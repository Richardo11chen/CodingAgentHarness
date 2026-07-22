import "dotenv/config"
import { createHarnessServer } from "./web/server.js"
import { createInterface } from "node:readline"
import { DEFAULT_CONFIG, loadConfig } from "./core/config.js"
import { RealLLMProvider } from "./core/llm.js"
import { Harness } from "./core/loop.js"
import { PolicyEngine } from "./core/governance/policy.js"
import { HitlStateMachine } from "./core/governance/hitl.js"
import { Sandbox } from "./core/governance/sandbox.js"
import { FeedbackValidator } from "./core/feedback/validator.js"
import { MemoryStore } from "./core/memory.js"
import { Tracer } from "./core/tracer.js"
import { fileRead, fileWrite, fileDelete } from "./core/tools/file.js"
import { shellExec } from "./core/tools/shell.js"
import { runTest } from "./core/tools/test-runner.js"
import { KeychainStore } from "./credentials/keychain.js"
import { EnvStore } from "./credentials/env.js"
import { existsSync, mkdirSync } from "node:fs"
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
    if (await envStore.hasKey("api_key")) return await envStore.get("api_key")
  }

  return null
}

function parseArgs(args: string[]) {
  const result: { command?: string; model?: string; provider?: string } = {}
  let parts: string[] = []
  for (let i = 2; i < args.length; i++) {
    if (args[i] === "-m" || args[i] === "--model") {
      result.model = args[++i]
    } else if (args[i] === "--provider") {
      result.provider = args[++i]
    } else {
      parts.push(args[i])
    }
  }
  if (parts.length > 0) result.command = parts.join(" ")
  return result
}

async function runCli(prompt: string, config: ReturnType<typeof loadConfig>, apiKey: string) {
  const workspaceDir = join("/tmp", "harness-cli", `run-${Date.now()}`)
  mkdirSync(workspaceDir, { recursive: true })

  const thinking = config.llm.thinking ?? false
  const reasoning_effort = config.llm.reasoning_effort ?? "high"

  const llm = new RealLLMProvider({
    baseURL: config.llm.baseURL,
    model: config.llm.model,
    apiKey,
    ...(thinking ? { thinking, reasoning_effort } : {}),
  })

  const harness = new Harness({
    llm,
    config,
    policyEngine: PolicyEngine.fromYaml(config.policies),
    hitl: new HitlStateMachine(),
    sandbox: new Sandbox(workspaceDir, config.sandbox),
    feedback: new FeedbackValidator(config.sensors),
    memory: new MemoryStore(join(workspaceDir, "memory.json")),
    tracer: new Tracer(500, (ev) => {
      // CLI 模式：简单输出关键步骤
      if (ev.type === "done") console.log("\n✅", (ev.data as any).answer)
      else if (ev.type === "error") console.log("\n❌", (ev.data as any).message)
    }),
    tools: { file_read: fileRead, file_write: fileWrite, file_delete: fileDelete, shell_exec: shellExec, run_test: runTest } as any,
  })

  console.log(`\n🤖 Coding Agent (${config.llm.model})`)
  console.log(`📝 ${prompt}\n`)

  const result = await harness.run(prompt)
  if (result.answer) {
    console.log(`\n${result.answer}`)
  } else {
    console.log("\nTask completed.")
  }
  console.log(`\nSteps: ${result.steps}`)
}

async function runInteractive(config: ReturnType<typeof loadConfig>, apiKey: string) {
  const workspaceDir = join("/tmp", "harness-cli", `run-${Date.now()}`)
  mkdirSync(workspaceDir, { recursive: true })

  const thinking = config.llm.thinking ?? false
  const reasoning_effort = config.llm.reasoning_effort ?? "high"

  const llm = new RealLLMProvider({
    baseURL: config.llm.baseURL,
    model: config.llm.model,
    apiKey,
    ...(thinking ? { thinking, reasoning_effort } : {}),
  })

  const harness = new Harness({
    llm,
    config,
    policyEngine: PolicyEngine.fromYaml(config.policies),
    hitl: new HitlStateMachine(),
    sandbox: new Sandbox(workspaceDir, config.sandbox),
    feedback: new FeedbackValidator(config.sensors),
    memory: new MemoryStore(join(workspaceDir, "memory.json")),
    tracer: new Tracer(500, (ev) => {
      if (ev.type === "done") process.stdout.write("\n✅ 完成\n")
    }),
    tools: { file_read: fileRead, file_write: fileWrite, file_delete: fileDelete, shell_exec: shellExec, run_test: runTest } as any,
  })

  console.log(`🤖 Coding Agent Harness CLI`)
  console.log(`   Model: ${config.llm.model} | Provider: ${config.llm.provider}`)
  console.log(`   Type your question or task. Empty line to exit.\n`)

  const rl = createInterface({ input: process.stdin, output: process.stdout })

  const ask = () => {
    rl.question("> ", async (line) => {
      if (!line.trim()) {
        rl.close()
        return
      }
      process.stdout.write("... ")
      const result = await harness.run(line)
      if (result.answer) {
        console.log(`\n${result.answer}\n`)
      } else {
        console.log(`\nDone. (${result.steps} steps)\n`)
      }
      ask()
    })
  }
  ask()
}

async function main() {
  const configPath = join(process.cwd(), ".harness", "config.yml")
  let config = existsSync(configPath) ? loadConfig(configPath) : DEFAULT_CONFIG

  const args = parseArgs(process.argv)

  // 覆盖模型
  if (args.model) {
    config.llm.model = args.model
  }
  if (args.provider) {
    const preset = (config.providers ?? []).find(p => p.key === args.provider)
    if (preset) {
      config.llm.model = preset.model
      config.llm.baseURL = preset.baseURL
      config.llm.thinking = preset.thinking ?? false
      config.llm.reasoning_effort = preset.reasoning_effort ?? "high"
      config.llm.provider = args.provider
    }
  }

  const apiKey = await getApiKey()
  if (!apiKey) {
    console.error("Error: No API key found. Set OPENAI_API_KEY env var or configure via WebUI.")
    process.exit(1)
  }

  // CLI 模式：有命令行参数
  if (args.command) {
    await runCli(args.command, config, apiKey)
    process.exit(0)
  }

  // 互动模式或 WebUI：无参数
  // 如果是从终端运行（stdin 是 TTY），启动互动模式
  if (process.stdin.isTTY) {
    await runInteractive(config, apiKey)
    process.exit(0)
  }

  // 非 TTY（比如被 systemd 启动），启动 WebUI
  const { port } = await createHarnessServer({ llm: undefined as any, config, projectDir: process.cwd() })
  console.log(`Coding Agent Harness running on http://localhost:${port}`)
}

main().catch(console.error)
