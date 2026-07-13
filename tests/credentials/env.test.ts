import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { EnvStore } from "../../src/credentials/env"
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs"
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
})
