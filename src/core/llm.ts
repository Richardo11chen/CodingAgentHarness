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

export interface RealLLMConfig {
  baseURL: string
  model: string
  apiKey: string
}

export class RealLLMProvider implements LLMProvider {
  private config: RealLLMConfig

  constructor(config: RealLLMConfig) {
    this.config = config
  }

  async complete(messages: Message[], options?: LLMOptions): Promise<LLMResponse> {
    const tools = [
      {
        type: "function",
        function: {
          name: "file_read",
          description: "Read a file",
          parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
        },
      },
      {
        type: "function",
        function: {
          name: "file_write",
          description: "Write to a file",
          parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
        },
      },
      {
        type: "function",
        function: {
          name: "shell_exec",
          description: "Execute a shell command",
          parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] },
        },
      },
      {
        type: "function",
        function: {
          name: "run_test",
          description: "Run tests",
          parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] },
        },
      },
    ]

    const body = {
      model: options?.model ?? this.config.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      tools,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
    }

    const res = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`LLM API error ${res.status}: ${errText}`)
    }

    const data = await res.json()
    const message = data.choices[0].message
    const text = message.content ?? ""
    const toolCall = message.tool_calls?.[0]

    if (!toolCall) {
      return { text, action: { type: "done", text } }
    }

    const args = JSON.parse(toolCall.function.arguments)
    return {
      text,
      action: {
        type: "call_tool",
        tool: toolCall.function.name,
        args,
        changedCode: toolCall.function.name === "file_write",
      },
    }
  }
}
