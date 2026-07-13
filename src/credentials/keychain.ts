import keytar from "keytar"

export interface CredentialStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
  hasKey(key: string): Promise<boolean>
}

export class KeychainStore implements CredentialStore {
  private service: string

  constructor(service: string) {
    this.service = service
  }

  async get(key: string): Promise<string | null> {
    return keytar.getPassword(this.service, key)
  }

  async set(key: string, value: string): Promise<void> {
    await keytar.setPassword(this.service, key, value)
  }

  async delete(key: string): Promise<void> {
    await keytar.deletePassword(this.service, key)
  }

  async hasKey(key: string): Promise<boolean> {
    const val = await this.get(key)
    return val !== null && val !== ""
  }
}
