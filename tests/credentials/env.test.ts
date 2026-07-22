import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { EnvStore } from "../../src/credentials/env"
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

describe("EnvStore", () => {
  let dir: string

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "env-")) })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it("writes and reads .env file", async () => {
    const store = new EnvStore(join(dir, ".env"))
    await store.set("API_KEY", "sk-test")
    const val = await store.get("API_KEY")
    expect(val).toBe("sk-test")
  })

  it("returns null for missing key", async () => {
    const store = new EnvStore(join(dir, ".env"))
    expect(await store.get("NOPE")).toBeNull()
  })

  it("deletes a key", async () => {
    const store = new EnvStore(join(dir, ".env"))
    await store.set("API_KEY", "sk-test")
    await store.delete("API_KEY")
    expect(await store.get("API_KEY")).toBeNull()
  })

  it("file has 600 permissions", async () => {
    const path = join(dir, ".env")
    const store = new EnvStore(path)
    await store.set("API_KEY", "sk-test")
    const stat = (await import("node:fs/promises")).stat(path)
    const mode = (await stat).mode & 0o777
    expect(mode).toBe(0o600)
  })

  it("handles case-insensitive key lookup", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "env-"))
    const envPath = join(tempDir, ".env")
    writeFileSync(envPath, "API_KEY=my-secret-key\n")
    const store = new EnvStore(envPath)
    expect(await store.hasKey("api_key")).toBe(true)
    expect(await store.get("api_key")).toBe("my-secret-key")
    rmSync(tempDir, { recursive: true, force: true })
  })

  it("creates parent directories on save", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "env-"))
    const deepPath = join(tempDir, "subdir", "nested", ".env")
    const store = new EnvStore(deepPath)
    await store.set("my_key", "hello")
    expect(existsSync(deepPath)).toBe(true)
    const data = readFileSync(deepPath, "utf-8")
    expect(data).toContain("my_key=hello")
    rmSync(tempDir, { recursive: true, force: true })
  })

  it("delete non-existent key does not throw", async () => {
    const store = new EnvStore(join(tmpdir(), "nonexistent.env"))
    await expect(store.delete("missing_key")).resolves.toBeUndefined()
  })

  it("hasKey returns false for empty value", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "env-"))
    const envPath = join(tempDir, ".env")
    writeFileSync(envPath, "EMPTY_KEY=\n")
    const store = new EnvStore(envPath)
    expect(await store.hasKey("empty_key")).toBe(false)
    rmSync(tempDir, { recursive: true, force: true })
  })

  it("set overwrites existing key", async () => {
    const store = new EnvStore(join(tmpdir(), "overwrite.env"))
    await store.set("key", "old")
    expect(await store.get("key")).toBe("old")
    await store.set("key", "new")
    expect(await store.get("key")).toBe("new")
  })

  it("handles missing env file gracefully", async () => {
    const store = new EnvStore(join(tmpdir(), "does-not-exist.env"))
    expect(await store.get("any_key")).toBeNull()
    expect(await store.hasKey("any_key")).toBe(false)
  })
})
