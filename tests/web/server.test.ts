import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { createServer } from "node:http"
import { createHarnessServer } from "../../src/web/server"
import { MockLLMProvider } from "../../src/core/llm"
import type { Server } from "node:http"

vi.mock("keytar", () => {
  const store = new Map<string, string>()
  return {
    default: {
      setPassword: vi.fn((service: string, account: string, password: string) => {
        store.set(`${service}:${account}`, password)
        return Promise.resolve()
      }),
      getPassword: vi.fn((service: string, account: string) => {
        return Promise.resolve(store.get(`${service}:${account}`) ?? null)
      }),
      deletePassword: vi.fn((service: string, account: string) => {
        return Promise.resolve(store.delete(`${service}:${account}`))
      }),
    },
  }
})

describe("WebUI Server", () => {
  let server: Server
  let port: number

  beforeAll(async () => {
    const result = await createHarnessServer({
      llm: new MockLLMProvider([{ text: "Done", action: { type: "done" } }]),
      config: {
        llm: { provider: "mock", model: "mock", baseURL: "" },
        tools: [], policies: "", sensors: { test: "", lint: "", typecheck: "" },
        sandbox: { timeout: 30, maxMemory: 512 }, maxSteps: 50, timeout: 300,
      },
      projectDir: process.cwd(),
    })
    server = result.server
    port = result.port
  })

  afterAll(() => server.close())

  it("GET /api/health returns ok", async () => {
    const res = await fetch(`http://localhost:${port}/api/health`)
    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(data.status).toBe("ok")
  })

  it("POST /api/sessions creates a session", async () => {
    const res = await fetch(`http://localhost:${port}/api/sessions`, { method: "POST" })
    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(data.id).toBeTruthy()
  })

  it("GET /api/config returns config", async () => {
    const res = await fetch(`http://localhost:${port}/api/config`)
    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(data.maxSteps).toBe(50)
  })

  it("GET /api/credentials returns hasKey boolean", async () => {
    const res = await fetch(`http://localhost:${port}/api/credentials`)
    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(typeof data.hasKey).toBe("boolean")
    expect(data.key).toBeUndefined()
  })

  it("POST /api/sessions/:id/message starts agent run", async () => {
    const cres = await fetch(`http://localhost:${port}/api/sessions`, { method: "POST" })
    const { id } = await cres.json()

    const res = await fetch(`http://localhost:${port}/api/sessions/${id}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "say hi" }),
    })
    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(data.status).toBe("started")
  })

  it("POST /api/sessions/:id/approve approves action", async () => {
    const cres = await fetch(`http://localhost:${port}/api/sessions`, { method: "POST" })
    const { id } = await cres.json()

    const res = await fetch(`http://localhost:${port}/api/sessions/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: true }),
    })
    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(data.status).toBe("ok")
  })

  it("POST /api/sessions/:id/approve denies action", async () => {
    const cres = await fetch(`http://localhost:${port}/api/sessions`, { method: "POST" })
    const { id } = await cres.json()

    const res = await fetch(`http://localhost:${port}/api/sessions/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: false }),
    })
    expect(res.ok).toBe(true)
  })

  it("DELETE /api/sessions/:id cleans up session", async () => {
    const cres = await fetch(`http://localhost:${port}/api/sessions`, { method: "POST" })
    const { id } = await cres.json()

    const res = await fetch(`http://localhost:${port}/api/sessions/${id}`, { method: "DELETE" })
    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(data.status).toBe("deleted")

    const check = await fetch(`http://localhost:${port}/api/sessions/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: true }),
    })
    expect(check.status).toBe(404)
  })

  it("GET /api/auth-token returns token", async () => {
    const res = await fetch(`http://localhost:${port}/api/auth-token`)
    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(data.token).toBeTruthy()
    expect(typeof data.token).toBe("string")
    expect(data.token.length).toBeGreaterThan(0)
  })

  it("returns 404 for unknown session message", async () => {
    const res = await fetch(`http://localhost:${port}/api/sessions/unknown/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "test" }),
    })
    expect(res.status).toBe(404)
  })

  it("PUT /api/config deep merges llm config", async () => {
    const prevCfg = await fetch(`http://localhost:${port}/api/config`).then(r => r.json())

    const res = await fetch(`http://localhost:${port}/api/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ llm: { model: "new-model" } }),
    })
    expect(res.ok).toBe(true)

    const newCfg = await fetch(`http://localhost:${port}/api/config`).then(r => r.json())
    expect(newCfg.llm.model).toBe("new-model")
    expect(newCfg.llm.provider).toBe(prevCfg.llm.provider)
  })

  it("POST /api/credentials saves key and rebuilds LLM", async () => {
    const res = await fetch(`http://localhost:${port}/api/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "sk-test-key" }),
    })
    expect(res.ok).toBe(true)

    const check = await fetch(`http://localhost:${port}/api/credentials`).then(r => r.json())
    expect(check.hasKey).toBe(true)
  })

  it("rejects empty message", async () => {
    const cres = await fetch(`http://localhost:${port}/api/sessions`, { method: "POST" })
    const { id } = await cres.json()

    const res = await fetch(`http://localhost:${port}/api/sessions/${id}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "   " }),
    })
    expect(res.status).toBe(400)
  })

  it("creates multiple sessions independently", async () => {
    const ids = new Set<string>()
    for (let i = 0; i < 5; i++) {
      const res = await fetch(`http://localhost:${port}/api/sessions`, { method: "POST" })
      const { id } = await res.json()
      ids.add(id)
      expect(id).toBeTruthy()
    }
    expect(ids.size).toBe(5)
  })
})
