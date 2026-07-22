import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { Sandbox } from "../../../src/core/governance/sandbox"
import { fileWrite, fileRead, fileDelete } from "../../../src/core/tools/file"
import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

describe("Sandbox", () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "sandbox-"))
  })
  afterEach(() => {
    try { rmSync("a.ts", { force: true }) } catch {}
    rmSync(dir, { recursive: true, force: true })
  })

  it("allows write inside project dir", async () => {
    const sandbox = new Sandbox(dir, { timeout: 30, maxMemory: 512 })
    const result = await sandbox.run(fileWrite, { path: join(dir, "a.ts"), content: "x" })
    expect(result.success).toBe(true)
  })

  it("blocks write outside project dir", async () => {
    const sandbox = new Sandbox(dir, { timeout: 30, maxMemory: 512 })
    const result = await sandbox.run(fileWrite, { path: "/etc/passwd", content: "hacked" })
    expect(result.success).toBe(false)
    expect(result.error).toContain("outside")
  })

  it("blocks absolute path outside project", async () => {
    const sandbox = new Sandbox(dir, { timeout: 30, maxMemory: 512 })
    const result = await sandbox.run(fileWrite, { path: "/tmp/outside.ts", content: "x" })
    expect(result.success).toBe(false)
  })

  it("resolves relative path into workspace dir", async () => {
    const sandbox = new Sandbox(dir, { timeout: 30, maxMemory: 512 })
    const result = await sandbox.run(fileWrite, { path: "a.ts", content: "data" })
    expect(result.success).toBe(true)
    const { statSync } = await import("node:fs")
    expect(() => statSync(join(dir, "a.ts"))).not.toThrow()
  })

  it("blocks path traversal with ../", async () => {
    const sandbox = new Sandbox(dir, { timeout: 30, maxMemory: 512 })
    const result = await sandbox.run(fileWrite, { path: "../outside.ts", content: "escape" })
    expect(result.success).toBe(false)
    expect(result.error).toContain("outside")
  })

  it("blocks file_read outside project dir", async () => {
    const sandbox = new Sandbox(dir, { timeout: 30, maxMemory: 512 })
    const result = await sandbox.run(fileRead, { path: "/etc/passwd" })
    expect(result.success).toBe(false)
    expect(result.error).toContain("outside")
  })

  it("blocks file_delete outside project dir", async () => {
    const sandbox = new Sandbox(dir, { timeout: 30, maxMemory: 512 })
    const result = await sandbox.run(fileDelete, { path: "/etc/hosts" })
    expect(result.success).toBe(false)
    expect(result.error).toContain("outside")
  })

  it("allows tools without path argument (e.g. shell_exec)", async () => {
    const sandbox = new Sandbox(dir, { timeout: 30, maxMemory: 512 })
    const result = await sandbox.run(
      async () => ({ success: true }),
      { command: "echo hello" }
    )
    expect(result.success).toBe(true)
  })
})
