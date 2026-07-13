import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { fileRead, fileWrite, fileDelete } from "../../../src/core/tools/file"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

describe("file tools", () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "harness-test-"))
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it("fileRead reads file content", async () => {
    const path = join(dir, "a.ts")
    writeFileSync(path, "hello world")
    const result = await fileRead({ path })
    expect(result.success).toBe(true)
    expect(result.content).toBe("hello world")
  })

  it("fileRead returns error for missing file", async () => {
    const result = await fileRead({ path: join(dir, "nope.ts") })
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it("fileWrite writes content", async () => {
    const path = join(dir, "b.ts")
    const result = await fileWrite({ path, content: "written" })
    expect(result.success).toBe(true)
    const readBack = await fileRead({ path })
    expect(readBack.content).toBe("written")
  })

  it("fileDelete removes file", async () => {
    const path = join(dir, "c.ts")
    writeFileSync(path, "temp")
    const result = await fileDelete({ path })
    expect(result.success).toBe(true)
    const readBack = await fileRead({ path })
    expect(readBack.success).toBe(false)
  })
})
