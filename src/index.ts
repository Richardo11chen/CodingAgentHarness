#!/usr/bin/env node
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
import type { Config } from "./core/types.js"

async function getApiKey(): Promise<string | null> {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY
  try {
    const keychain = new KeychainStore("coding-agent-harness")
    if (await keychain.hasKey("api_key")) return await keychain.get("api_key")
  } catch {}
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

async function runCli(prompt: string, config: Config, apiKey: string) {
  const workspaceDir = join("/tmp", "harness-cli", `run-${Date.now()}`)
  mkdirSync(workspaceDir, { recursive: true })
  const thinking = config.llm.thinking ?? false
  const llm = new RealLLMProvider({
    baseURL: config.llm.baseURL, model: config.llm.model, apiKey,
    ...(thinking ? { thinking, reasoning_effort: config.llm.reasoning_effort ?? "high" } : {}),
  })
  const harness = new Harness({
    llm, config,
    policyEngine: PolicyEngine.fromYaml(config.policies),
    hitl: new HitlStateMachine(),
    sandbox: new Sandbox(workspaceDir, config.sandbox),
    feedback: new FeedbackValidator(config.sensors),
    memory: new MemoryStore(join(workspaceDir, "memory.json")),
    tracer: new Tracer(500, (ev) => {
      if (ev.type === "done") console.log("\n✅", (ev.data as any).answer)
      else if (ev.type === "error") console.log("\n❌", (ev.data as any).message)
    }),
    tools: { file_read: fileRead, file_write: fileWrite, file_delete: fileDelete, shell_exec: shellExec, run_test: runTest } as any,
  })
  console.log(`\n🤖 Coding Agent (${config.llm.model})\n📝 ${prompt}\n`)
  const result = await harness.run(prompt)
  console.log(result.answer || "Done.")
  console.log(`Steps: ${result.steps}`)
}

function buildLlm(config: Config, apiKey: string) {
  const t = config.llm.thinking ?? false
  return new RealLLMProvider({
    baseURL: config.llm.baseURL, model: config.llm.model, apiKey,
    ...(t ? { thinking: t, reasoning_effort: config.llm.reasoning_effort ?? "high" } : {}),
  })
}

function printHelp() {
  console.log(`
  Commands:
    /model <name>      切换到指定模型
    /provider <key>    切换到预设供应商 (openai, deepseek-v4, deepseek-flash)
    /providers         列出所有可用供应商
    /thinking          切换 Thinking 模式 on/off
    /thinking high|max 设置推理强度
    /connect <key>     设置 API Key
    /config            显示当前配置
    /key               显示当前 Key 状态
    /baseurl <url>     设置 Base URL
    /clear             清除对话上下文
    /help              显示帮助
    /exit 或 空行      退出
`)
}

async function runInteractive(config: Config, apiKey: string) {
  printHelp()

  function showStatus() {
    const t = config.llm.thinking ? `ON(${config.llm.reasoning_effort || "high"})` : "OFF"
    console.log(`  Model: ${config.llm.model} | Provider: ${config.llm.provider}`)
    console.log(`  Thinking: ${t} | BaseURL: ${config.llm.baseURL}`)
    console.log(`  Key: ${apiKey ? "✅ configured" : "❌ not set"}  (设置 /connect <key>)\n`)
  }
  showStatus()

  function rebootHarness() {
    const wsDir = join("/tmp", "harness-cli", `run-${Date.now()}`)
    mkdirSync(wsDir, { recursive: true })
    return new Harness({
      llm: buildLlm(config, apiKey),
      config,
      policyEngine: PolicyEngine.fromYaml(config.policies),
      hitl: new HitlStateMachine(),
      sandbox: new Sandbox(wsDir, config.sandbox),
      feedback: new FeedbackValidator(config.sensors),
      memory: new MemoryStore(join(wsDir, "memory.json")),
      tracer: new Tracer(500, () => {}),
      tools: { file_read: fileRead, file_write: fileWrite, file_delete: fileDelete, shell_exec: shellExec, run_test: runTest } as any,
    })
  }

  let harness = rebootHarness()
  const rl = createInterface({ input: process.stdin, output: process.stdout })

  const ask = () => {
    rl.question("> ", async (line) => {
      const input = line.trim()
      if (!input) { rl.close(); return }

      // —— 命令处理 ——
      if (input.startsWith("/")) {
        const [cmd, ...rest] = input.slice(1).split(/\s+/)
        const arg = rest.join(" ")

        if (cmd === "help") {
          printHelp()
        } else if (cmd === "providers") {
          console.log("\n  可用供应商:")
          ;(config.providers ?? []).forEach(p => {
            const mark = p.key === config.llm.provider ? " *" : ""
            console.log(`    ${p.key}: ${p.name}  (${p.model})${p.thinking ? " [Thinking]" : ""}${mark}`)
          })
          console.log("")
        } else if (cmd === "provider") {
          const preset = (config.providers ?? []).find(p => p.key === arg)
          if (!preset) { console.log(`  ❌ 未知供应商: ${arg}\n`); return ask() }
          config.llm.provider = arg
          config.llm.model = preset.model
          config.llm.baseURL = preset.baseURL
          config.llm.thinking = preset.thinking ?? false
          config.llm.reasoning_effort = preset.reasoning_effort ?? "high"
          harness = rebootHarness()
          console.log(`  ✅ 已切换到: ${preset.name} (${preset.model})\n`)
        } else if (cmd === "model") {
          if (!arg) { console.log("  Usage: /model <name>\n"); return ask() }
          config.llm.model = arg
          harness = rebootHarness()
          console.log(`  ✅ 模型已切换: ${arg}\n`)
        } else if (cmd === "thinking") {
          if (arg === "high" || arg === "max") {
            config.llm.reasoning_effort = arg
            harness = rebootHarness()
            console.log(`  ✅ 推理强度: ${arg}\n`)
          } else {
            config.llm.thinking = !config.llm.thinking
            harness = rebootHarness()
            console.log(`  ✅ Thinking: ${config.llm.thinking ? "ON" : "OFF"}\n`)
          }
        } else if (cmd === "baseurl") {
          if (!arg) { console.log("  Usage: /baseurl <url>\n"); return ask() }
          config.llm.baseURL = arg
          harness = rebootHarness()
          console.log(`  ✅ BaseURL: ${arg}\n`)
        } else if (cmd === "connect") {
          if (!arg) { console.log("  Usage: /connect <api-key>\n"); return ask() }
          apiKey = arg
          harness = rebootHarness()
          console.log(`  ✅ API Key 已设置\n`)
        } else if (cmd === "key") {
          console.log(`  Key: ${apiKey ? "✅ configured (" + apiKey.slice(0,8) + "...)" : "❌ not set"}\n`)
        } else if (cmd === "config") {
          console.log(`  Model:      ${config.llm.model}`)
          console.log(`  Provider:   ${config.llm.provider}`)
          console.log(`  BaseURL:    ${config.llm.baseURL}`)
          console.log(`  Thinking:   ${config.llm.thinking ? "ON" : "OFF"}`)
          console.log(`  Effort:     ${config.llm.reasoning_effort || "high"}`)
          console.log(`  MaxSteps:   ${config.maxSteps}`)
          console.log(`  Timeout:    ${config.timeout}s`)
          console.log(`  Key:        ${apiKey ? "✅ configured" : "❌ not set"}\n`)
        } else if (cmd === "clear") {
          harness = rebootHarness()
          console.log(`  ✅ 对话上下文已清除\n`)
        } else if (cmd === "exit") {
          rl.close(); return
        } else {
          console.log(`  ❌ 未知命令: /${cmd}  (输入 /help 查看帮助)\n`)
        }
        ask()
        return
      }

      // —— 发给 Agent ——
      if (!apiKey) {
        console.log("  ❌ 未设置 API Key。请用 /connect <key> 设置，或设置环境变量 OPENAI_API_KEY\n")
        ask()
        return
      }
      process.stdout.write("... ")
      const result = await harness.run(input)
      const out = result.answer || "Done."
      console.log(`\n${out}\n`)
      ask()
    })
  }
  ask()
}

async function main() {
  const configPath = join(process.cwd(), ".harness", "config.yml")
  let config = existsSync(configPath) ? loadConfig(configPath) : DEFAULT_CONFIG

  const args = parseArgs(process.argv)
  if (args.model) config.llm.model = args.model
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

  let apiKey = await getApiKey()

  if (args.command) {
    if (!apiKey) { console.error("Error: No API key found."); process.exit(1) }
    await runCli(args.command, config, apiKey)
    process.exit(0)
  }

  if (process.stdin.isTTY) {
    await runInteractive(config, apiKey!)
    process.exit(0)
  }

  const { port } = await createHarnessServer({ llm: undefined as any, config, projectDir: process.cwd() })
  console.log(`Coding Agent Harness running on http://localhost:${port}`)
}

main().catch(console.error)
