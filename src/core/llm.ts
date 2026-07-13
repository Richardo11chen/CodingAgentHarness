import type { Message, LLMResponse, LLMOptions } from "./types.js"

export interface LLMProvider {
  complete(messages: Message[], options?: LLMOptions): Promise<LLMResponse>
}

export class MockLLMProvider implements LLMProvider {
  private responses: LLMResponse[]

  constructor(responses: LLMResponse[]) {
    this.responses = [...responses]
  }

  async complete(_messages: Message[], _options?: LLMOptions): Promise<LLMResponse> {
    if (this.responses.length === 0) {
      return { text: "done", action: { type: "done" } }
    }
    return this.responses.shift()!
  }
}
