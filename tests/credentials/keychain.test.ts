import { describe, it, expect, vi } from "vitest"
import { KeychainStore } from "../../src/credentials/keychain"

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

describe("KeychainStore", () => {
  it("stores and retrieves a key", async () => {
    const store = new KeychainStore("coding-agent-harness")
    await store.set("api_key", "sk-test-key")
    const key = await store.get("api_key")
    expect(key).toBe("sk-test-key")
  })

  it("returns null for missing key", async () => {
    const store = new KeychainStore("coding-agent-harness")
    const key = await store.get("nonexistent")
    expect(key).toBeNull()
  })

  it("deletes a key", async () => {
    const store = new KeychainStore("coding-agent-harness")
    await store.delete("api_key")
    const key = await store.get("api_key")
    expect(key).toBeNull()
  })

  it("hasKey returns boolean without revealing value", async () => {
    const store = new KeychainStore("coding-agent-harness")
    await store.set("api_key", "sk-secret")
    expect(await store.hasKey("api_key")).toBe(true)
    expect(await store.hasKey("other")).toBe(false)
  })

  it("getPassword handles empty string as not found", async () => {
    const store = new KeychainStore("test-service")
    expect(await store.get("nonexistent")).toBeNull()
    expect(await store.hasKey("nonexistent")).toBe(false)
  })
})
