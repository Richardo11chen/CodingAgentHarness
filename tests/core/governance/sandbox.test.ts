import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { Sandbox } from "../../../src/core/governance/sandbox"
import { fileWrite } from "../../../src/core/tools/file"
import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

describe("Sandbox", () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "sandbox-"))
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

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
})
