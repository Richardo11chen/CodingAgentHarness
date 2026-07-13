import { readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs"
import type { CredentialStore } from "./keychain.js"

export class EnvStore implements CredentialStore {
  private filePath: string
  private data: Record<string, string> = {}

  constructor(filePath: string) {
    this.filePath = filePath
    this.load()
  }

  async get(key: string): Promise<string | null> {
    return this.data[key] ?? null
  }

  async set(key: string, value: string): Promise<void> {
    this.data[key] = value
    this.save()
  }

  async delete(key: string): Promise<void> {
    delete this.data[key]
    this.save()
  }

  async hasKey(key: string): Promise<boolean> {
    return this.data[key] !== undefined && this.data[key] !== ""
  }

  private load(): void {
    if (!existsSync(this.filePath)) return
    const raw = readFileSync(this.filePath, "utf-8")
    for (const line of raw.split("\n")) {
      const match = line.match(/^([^=]+)=(.*)$/)
      if (match) {
        this.data[match[1].trim()] = match[1].trim() === "API_KEY" ? match[2] : match[2]
      }
    }
  }

  private save(): void {
    const content = Object.entries(this.data).map(([k, v]) => `${k}=${v}`).join("\n")
    writeFileSync(this.filePath, content, { mode: 0o600 })
    chmodSync(this.filePath, 0o600)
  }
}
