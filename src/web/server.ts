import express from "express"
import { WebSocketServer } from "ws"
import { createServer } from "node:http"
import type { LLMProvider } from "../core/llm.js"
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
import { dirname, join } from "node:path"
import { mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))

export interface ServerDeps {
  llm: LLMProvider
  config: Config
  projectDir: string
}

export async function createHarnessServer(deps: ServerDeps): Promise<{ server: import("node:http").Server; port: number }> {
  const app = express()
  app.use(express.json())
  app.use(express.static(join(__dirname, "..", "..", "dist", "frontend")))

  const server = createServer(app)
  const wss = new WebSocketServer({ server, path: "/ws" })
  wss.on("connection", (ws) => {
    console.log(`WebSocket client connected (total: ${wss.clients.size})`)
    ws.on("close", () => console.log("WebSocket client disconnected"))
  })

  const sessions = new Map<string, { harness: Harness; hitl: HitlStateMachine; tracer: Tracer }>()
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

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" })
  })

  // Sessions
  app.post("/api/sessions", (_req, res) => {
    const id = `session-${Date.now()}`
    const workspaceDir = join(deps.projectDir, "workspaces", id)
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
      memory: new MemoryStore(join(workspaceDir, "memory.json")),
      tracer,
      tools: { file_read: fileRead, file_write: fileWrite, file_delete: fileDelete, shell_exec: shellExec, run_test: runTest } as Record<string, Tool>,
    })
    sessions.set(id, { harness, hitl, tracer })
    res.json({ id })
  })

  app.post("/api/sessions/:id/message", async (req, res) => {
    const session = sessions.get(req.params.id)
    if (!session) return res.status(404).json({ error: "session not found" })
    if (!deps.llm) return res.status(400).json({ error: "No LLM configured. Set OPENAI_API_KEY env var or configure via WebUI." })
    const { message } = req.body
    session.harness.run(message).then((result) => {
      console.log(`Harness completed: steps=${result.steps}, answer=${result.answer?.slice(0, 50)}`)
      wss.clients.forEach((client) => {
        if (client.readyState === 1) client.send(JSON.stringify({ type: "done", data: result }))
      })
    }).catch((err) => {
      console.error(`Harness error: ${err.message}`)
      wss.clients.forEach((client) => {
        if (client.readyState === 1) client.send(JSON.stringify({ type: "error", data: { message: err.message } }))
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

  // Config
  app.get("/api/config", (_req, res) => {
    res.json(deps.config)
  })

  app.put("/api/config", (req, res) => {
    Object.assign(deps.config, req.body)
    res.json({ status: "ok" })
  })

  // Credentials
  app.get("/api/credentials", async (_req, res) => {
    const hasKey = await credentialStore.hasKey("api_key")
    res.json({ hasKey })
  })

  app.post("/api/credentials", async (req, res) => {
    const { key } = req.body
    if (!key) return res.status(400).json({ error: "key required" })
    await credentialStore.set("api_key", key)
    res.json({ status: "ok" })
  })

  app.delete("/api/credentials", async (_req, res) => {
    await credentialStore.delete("api_key")
    res.json({ status: "ok" })
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
