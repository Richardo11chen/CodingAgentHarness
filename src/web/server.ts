import express from "express"
import { WebSocketServer } from "ws"
import { createServer } from "node:http"
import type { LLMProvider } from "../core/llm.js"
import { RealLLMProvider } from "../core/llm.js"
import type { Config } from "../core/types.js"
import { Harness } from "../core/loop.js"
import { PolicyEngine } from "../core/governance/policy.js"
import { HitlStateMachine } from "../core/governance/hitl.js"
import { Sandbox } from "../core/governance/sandbox.js"
import { FeedbackValidator } from "../core/feedback/validator.js"
import { MemoryStore } from "../core/memory.js"
import { Tracer } from "../core/tracer.js"
import { fileRead, fileWrite, fileDelete } from "../core/tools/file.js"
import { shellExec } from "../core/tools/shell.js"
import { runTest } from "../core/tools/test-runner.js"
import type { Tool } from "../core/tools/file.js"
import { KeychainStore, type CredentialStore } from "../credentials/keychain.js"
import { EnvStore } from "../credentials/env.js"
import { randomBytes } from "node:crypto"
import { dirname, join } from "node:path"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { parse as parseYaml, stringify } from "yaml"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))

export interface ServerDeps {
  llm: LLMProvider | undefined
  config: Config
  projectDir: string
}

export async function createHarnessServer(deps: ServerDeps): Promise<{ server: import("node:http").Server; port: number }> {
  const app = express()
  app.use(express.json())
  app.use(express.static(join(__dirname, "..", "..", "dist", "frontend")))

  const server = createServer(app)
  const wss = new WebSocketServer({ server, path: "/ws" })
  wss.on("connection", (ws, req) => {
    const url = new URL(req.url ?? "", `http://${req.headers.host ?? "localhost"}`)
    const token = url.searchParams.get("token")
    if (token !== null && token !== wsAuthToken) {
      console.log(`WebSocket rejected: invalid token`)
      ws.close(4001, "Unauthorized")
      return
    }
    const sessionId = url.searchParams.get("sessionId")
    if (sessionId) (ws as any).sessionId = sessionId
    console.log(`WebSocket client connected (total: ${wss.clients.size}, session: ${sessionId ?? "none"})`)
    ws.on("close", () => console.log(`WebSocket client disconnected (session: ${(ws as any).sessionId ?? "none"})`))
  })

  const sessions = new Map<string, { harness: Harness; hitl: HitlStateMachine; tracer: Tracer; running: boolean; workspaceDir: string; context: any[] }>()
  const wsAuthToken = randomBytes(16).toString("hex")
  console.log(`WS Auth Token: ${wsAuthToken}`)
  const envStore = new EnvStore(join(deps.projectDir, ".harness", ".env"))
  let credentialStore: CredentialStore
  try {
    const kc = new KeychainStore("coding-agent-harness")
    await kc.get("__probe__")
    credentialStore = kc
  } catch {
    credentialStore = envStore
    console.log("keytar not available, using .env fallback for credentials")
  }

  async function rebuildLLM() {
    const key = await getApiKey()
    if (!key) {
      deps.llm = undefined
      return
    }
    const thinking = deps.config.llm.thinking ?? false
    const reasoning_effort = deps.config.llm.reasoning_effort ?? "high"
    deps.llm = new RealLLMProvider({
      baseURL: deps.config.llm.baseURL,
      model: deps.config.llm.model,
      apiKey: key,
      ...(thinking ? { thinking, reasoning_effort } : {}),
    })
  }

  async function getApiKey(): Promise<string | null> {
    const provider = deps.config.llm.provider
    const providerKey = `api_key:${provider}`
    const hasProviderKey = await credentialStore.hasKey(providerKey)
    if (hasProviderKey) {
      const k = await credentialStore.get(providerKey)
      if (k) return k
    }
    const hasKey = await credentialStore.hasKey("api_key")
    if (hasKey) {
      const k = await credentialStore.get("api_key")
      if (k) return k
    }
    return process.env.OPENAI_API_KEY ?? null
  }

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" })
  })

  function saveConfigToFile() {
    try {
      const configPath = join(deps.projectDir, ".harness", "config.yml")
      const yaml = stringify({
        llm: deps.config.llm,
        tools: deps.config.tools,
        policies: deps.config.policies || ".harness/policies.yml",
        sensors: deps.config.sensors,
        sandbox: deps.config.sandbox,
        maxSteps: deps.config.maxSteps,
        timeout: deps.config.timeout,
        providers: deps.config.providers,
      })
      writeFileSync(configPath, yaml, "utf-8")
    } catch (e: any) {
      console.error(`Failed to save config: ${e.message}`)
    }
  }

  app.get("/api/auth-token", (_req, res) => {
    res.json({ token: wsAuthToken })
  })

  function asyncHandler(fn: (req: any, res: any, next: any) => Promise<any>) {
    return (req: any, res: any, next: any) => fn(req, res, next).catch(next)
  }

  // Sessions
  app.post("/api/sessions", (_req, res) => {
    const id = `session-${Date.now()}`
    const workspaceDir = deps.projectDir
    mkdirSync(join(deps.projectDir, ".harness", "memory"), { recursive: true })
    mkdirSync(workspaceDir, { recursive: true })
    const tracer = new Tracer(500, (event) => {
      wss.clients.forEach((client) => {
        if (client.readyState === 1) client.send(JSON.stringify(event))
      })
    })
    const hitl = new HitlStateMachine()
    const harness = new Harness({
      llm: deps.llm,
      config: deps.config,
      policyEngine: PolicyEngine.fromYaml(deps.config.policies),
      hitl,
      sandbox: new Sandbox(workspaceDir, deps.config.sandbox),
      feedback: new FeedbackValidator(deps.config.sensors),
      memory: new MemoryStore(join(deps.projectDir, ".harness", "memory", `${id}.json`)),
      tracer,
      tools: { file_read: fileRead, file_write: fileWrite, file_delete: fileDelete, shell_exec: shellExec, run_test: runTest } as Record<string, Tool>,
    })
    sessions.set(id, { harness, hitl, tracer, running: false, workspaceDir, context: [] })
    res.json({ id })
  })

  app.post("/api/sessions/:id/message", async (req, res) => {
    const session = sessions.get(req.params.id)
    if (!session) return res.status(404).json({ error: "session not found" })
    if (!deps.llm) return res.status(400).json({ error: "No LLM configured. Set API key via Settings." })
    if (session.running) return res.status(409).json({ error: "agent is still running, please wait" })

    const { message, msgId } = req.body
    if (!message || !message.trim()) return res.status(400).json({ error: "message required" })
    const mid = msgId || ""

    session.running = true
    const prevContext = session.context || []
    session.harness.run(message, prevContext).then((result) => {
      session.running = false
      // 更新上下文历史
      session.context = [
        ...prevContext,
        { role: "user", content: message },
        { role: "assistant", content: result.answer || "" },
      ]
      // 限制上下文长度，避免爆炸
      if (session.context.length > 40) {
        session.context = session.context.slice(-40)
      }
      console.log(`Harness completed: steps=${result.steps}, answer=${result.answer?.slice(0, 50)}`)
      wss.clients.forEach((client) => {
        if (client.readyState === 1 && ((client as any).sessionId === req.params.id || !(client as any).sessionId)) {
          client.send(JSON.stringify({ type: "done", data: result, sessionId: req.params.id, msgId: mid }))
        }
      })
    }).catch((err) => {
      session.running = false
      console.error(`Harness error: ${err.message}`)
      wss.clients.forEach((client) => {
        if (client.readyState === 1 && ((client as any).sessionId === req.params.id || !(client as any).sessionId)) {
          client.send(JSON.stringify({ type: "error", data: { message: err.message }, sessionId: req.params.id, msgId: mid }))
        }
      })
    })
    res.json({ status: "started" })
  })

  app.post("/api/sessions/:id/approve", (req, res) => {
    const session = sessions.get(req.params.id)
    if (!session) return res.status(404).json({ error: "session not found" })
    const { approved } = req.body
    if (approved) session.hitl.approve()
    else session.hitl.deny()
    res.json({ status: "ok" })
  })

  app.post("/api/sessions/:id/stop", (req, res) => {
    const session = sessions.get(req.params.id)
    if (!session) return res.status(404).json({ error: "session not found" })
    session.hitl.stop()
    res.json({ status: "stopped" })
  })

  // Providers
  app.get("/api/providers", (_req, res) => {
    res.json(deps.config.providers ?? [])
  })

  app.post("/api/providers/activate", asyncHandler(async (req, res) => {
    const { key } = req.body
    if (!key) return res.status(400).json({ error: "provider key required" })
    const providers = deps.config.providers ?? []
    const preset = providers.find(p => p.key === key)
    if (!preset) return res.status(404).json({ error: "provider not found" })

    deps.config.llm.model = preset.model
    deps.config.llm.baseURL = preset.baseURL
    deps.config.llm.thinking = preset.thinking ?? false
    deps.config.llm.provider = key
    deps.config.llm.reasoning_effort = preset.reasoning_effort ?? "high"

    saveConfigToFile()
    await rebuildLLM()
    res.json({ status: "ok", provider: key, model: preset.model, thinking: preset.thinking, reasoning_effort: preset.reasoning_effort ?? "high" })
  }))

  // Provider credentials
  app.post("/api/providers/:key/credentials", asyncHandler(async (req, res) => {
    const providerKey = `api_key:${req.params.key}`
    const { key } = req.body
    if (!key) return res.status(400).json({ error: "key required" })
    await credentialStore.set(providerKey, key)
    if (deps.config.llm.provider === req.params.key) {
      await rebuildLLM()
    }
    res.json({ status: "ok" })
  }))

  app.delete("/api/providers/:key/credentials", asyncHandler(async (req, res) => {
    await credentialStore.delete(`api_key:${req.params.key}`)
    res.json({ status: "ok" })
  }))

  app.get("/api/providers/:key/credentials", asyncHandler(async (req, res) => {
    const providerKey = `api_key:${req.params.key}`
    const has = await credentialStore.hasKey(providerKey)
    res.json({ hasKey: has })
  }))

  app.delete("/api/sessions/:id", (req, res) => {
    const session = sessions.get(req.params.id)
    if (!session) return res.status(404).json({ error: "session not found" })
    session.hitl.stop()
    sessions.delete(req.params.id)
    res.json({ status: "deleted" })
  })

  // Config
  app.get("/api/config", (_req, res) => {
    res.json(deps.config)
  })

  app.put("/api/config", asyncHandler(async (req, res) => {
    if (req.body.providers) {
      deps.config.providers = req.body.providers
    }
    Object.assign(deps.config, { ...req.body, llm: { ...deps.config.llm, ...req.body.llm }, policies: deps.config.policies })
    saveConfigToFile()
    await rebuildLLM()
    res.json({ status: "ok" })
  }))

  // Credentials
  app.get("/api/credentials", asyncHandler(async (_req, res) => {
    const hasKey = await credentialStore.hasKey("api_key")
    res.json({ hasKey })
  }))

  app.post("/api/credentials", asyncHandler(async (req, res) => {
    const { key } = req.body
    if (!key) return res.status(400).json({ error: "key required" })
    await credentialStore.set("api_key", key)
    await rebuildLLM()
    res.json({ status: "ok" })
  }))

  app.delete("/api/credentials", asyncHandler(async (_req, res) => {
    await credentialStore.delete("api_key")
    deps.llm = undefined
    res.json({ status: "ok" })
  }))

  // Error handler
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error("Unhandled error:", err)
    res.status(500).json({ error: "Internal server error" })
  })

  // SPA catch-all: serve index.html for non-API routes
  app.get("*", (_req, res) => {
    res.sendFile(join(__dirname, "..", "..", "dist", "frontend", "index.html"))
  })

  return new Promise((resolve) => {
    const port = parseInt(process.env.PORT ?? "3000", 10)
    server.listen(port, () => {
      resolve({ server, port })
    })
  })
}
