import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { MemoryStore } from "../../src/core/memory"
import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

describe("MemoryStore", () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "memory-"))
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it("writes and reads back a note", () => {
    const store = new MemoryStore(join(dir, "memory.json"))
    store.write("Use Vitest for testing")
    const results = store.read("testing")
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]).toContain("Vitest")
  })

  it("returns empty for no matches", () => {
    const store = new MemoryStore(join(dir, "memory.json"))
    store.write("Use Vitest for testing")
    const results = store.read("nonexistent")
    expect(results).toHaveLength(0)
  })

  it("consolidate persists across instances", () => {
    const path = join(dir, "memory.json")
    const store1 = new MemoryStore(path)
    store1.write("Important decision: use ESM")
    store1.consolidate("session context with ESM decision")
    const store2 = new MemoryStore(path)
    const results = store2.read("ESM")
    expect(results.length).toBeGreaterThan(0)
  })

  it("enforces max entries with LRU", () => {
    const store = new MemoryStore(join(dir, "memory.json"), 3)
    store.write("note 1")
    store.write("note 2")
    store.write("note 3")
    store.write("note 4")
    const results = store.read("note 1")
    expect(results).toHaveLength(0)
  })
})
