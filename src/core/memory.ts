import { readFileSync, writeFileSync, existsSync } from "node:fs"

interface MemoryEntry {
  content: string
  lastAccessed: number
}

export class MemoryStore {
  private entries: MemoryEntry[] = []
  private filePath: string
  private maxEntries: number

  constructor(filePath: string, maxEntries = 1000) {
    this.filePath = filePath
    this.maxEntries = maxEntries
    this.load()
  }

  write(note: string): void {
    this.entries.push({ content: note, lastAccessed: Date.now() })
    this.evict()
    this.save()
  }

  read(query: string): string[] {
    const lower = query.toLowerCase()
    const matched = this.entries.filter((e) => e.content.toLowerCase().includes(lower))
    matched.forEach((e) => (e.lastAccessed = Date.now()))
    this.save()
    return matched.map((e) => e.content)
  }

  consolidate(context: string): void {
    this.write(`[consolidated] ${context.slice(0, 500)}`)
  }

  private load(): void {
    if (!existsSync(this.filePath)) return
    try {
      const raw = readFileSync(this.filePath, "utf-8")
      this.entries = JSON.parse(raw)
    } catch {
      this.entries = []
    }
  }

  private save(): void {
    try {
      writeFileSync(this.filePath, JSON.stringify(this.entries, null, 2))
    } catch {
      // ignore save errors
    }
  }

  private evict(): void {
    while (this.entries.length > this.maxEntries) {
      const oldest = this.entries.reduce((min, e, i) => (e.lastAccessed < this.entries[min].lastAccessed ? i : min), 0)
      this.entries.splice(oldest, 1)
    }
  }
}
