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
})
