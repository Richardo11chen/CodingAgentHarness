export interface CredentialStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
  hasKey(key: string): Promise<boolean>
}

let _keytar: any = null
let _tried = false

async function getKeytar(): Promise<any | null> {
  if (!_tried) {
    _tried = true
    try {
      const mod = await import("keytar")
      _keytar = mod.default ?? mod
    } catch {
      _keytar = null
    }
  }
  return _keytar
}

export class KeychainStore implements CredentialStore {
  private service: string

  constructor(service: string) {
    this.service = service
  }

  async get(key: string): Promise<string | null> {
    const keytar = await getKeytar()
    if (!keytar) throw new Error("keytar not available (libsecret missing)")
    return keytar.getPassword(this.service, key)
  }

  async set(key: string, value: string): Promise<void> {
    const keytar = await getKeytar()
    if (!keytar) throw new Error("keytar not available (libsecret missing)")
    await keytar.setPassword(this.service, key, value)
  }

  async delete(key: string): Promise<void> {
    const keytar = await getKeytar()
    if (!keytar) throw new Error("keytar not available (libsecret missing)")
    await keytar.deletePassword(this.service, key)
  }

  async hasKey(key: string): Promise<boolean> {
    try {
      const val = await this.get(key)
      return val !== null && val !== ""
    } catch {
      return false
    }
  }
}
