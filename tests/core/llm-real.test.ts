import { describe, it, expect, vi } from "vitest"
import { RealLLMProvider } from "../../src/core/llm"

// Mock global fetch
global.fetch = vi.fn()

describe("RealLLMProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calls OpenAI-compatible API with correct format", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: "I'll help",
            tool_calls: [{
              function: {
                name: "file_read",
                arguments: '{"path":"a.ts"}',
              },
            }],
          },
        }],
      }),
    })

    const provider = new RealLLMProvider({
      baseURL: "https://api.example.com/v1",
      model: "test-model",
      apiKey: "sk-test",
    })

    const response = await provider.complete([{ role: "user", content: "read a.ts" }])
    expect(response.text).toBe("I'll help")
    expect(response.action.type).toBe("call_tool")
    expect(response.action.tool).toBe("file_read")

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.example.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Authorization": "Bearer sk-test",
          "Content-Type": "application/json",
        }),
      })
    )
  })

  it("handles done action (no tool calls)", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Task complete" } }],
      }),
    })
    const provider = new RealLLMProvider({
      baseURL: "https://api.example.com/v1",
      model: "test",
      apiKey: "sk-test",
    })
    const response = await provider.complete([])
    expect(response.action.type).toBe("done")
    expect(response.text).toBe("Task complete")
  })

  it("includes file_delete in tools", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "ok" } }],
      }),
    })
    const provider = new RealLLMProvider({ baseURL: "https://api.example.com/v1", model: "test", apiKey: "sk" })
    await provider.complete([{ role: "user", content: "test" }])

    const call = (global.fetch as any).mock.calls[0]
    const body = JSON.parse(call[1].body)
    const toolNames = body.tools.map((t: any) => t.function.name)
    expect(toolNames).toContain("file_delete")
    expect(toolNames).toContain("file_read")
    expect(toolNames).toContain("file_write")
    expect(toolNames).toContain("shell_exec")
    expect(toolNames).toContain("run_test")
  })

  it("convertMessages transforms tool_calls and tool results correctly", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "done" } }],
      }),
    })
    const provider = new RealLLMProvider({ baseURL: "https://api.example.com/v1", model: "test", apiKey: "sk" })

    const messages = [
      { role: "user" as const, content: "read file" },
      { role: "assistant" as const, content: "reading", action: { type: "call_tool" as const, tool: "file_read", args: { path: "a.ts" } } },
      { role: "user" as const, content: 'Tool result: {"success":true,"content":"hello"}' },
    ]
    await provider.complete(messages)

    const call = (global.fetch as any).mock.calls[0]
    const body = JSON.parse(call[1].body)
    const converted = body.messages

    expect(converted.length).toBe(3)
    expect(converted[0].role).toBe("user")
    expect(converted[1].role).toBe("assistant")
    expect(converted[1].tool_calls).toBeDefined()
    expect(converted[1].tool_calls[0].function.name).toBe("file_read")
    expect(converted[2].role).toBe("tool")
    expect(converted[2].tool_call_id).toBe("call_0")
  })

  it("convertMessages handles denied action message as tool result", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "ok" } }],
      }),
    })
    const provider = new RealLLMProvider({ baseURL: "https://api.example.com/v1", model: "test", apiKey: "sk" })

    const messages = [
      { role: "user" as const, content: "delete all" },
      { role: "assistant" as const, content: "deleting", action: { type: "call_tool" as const, tool: "shell_exec", args: { command: "rm -rf /" } } },
      { role: "user" as const, content: "Tool result: Action denied - policy violation" },
    ]
    await provider.complete(messages)

    const call = (global.fetch as any).mock.calls[0]
    const body = JSON.parse(call[1].body)
    const converted = body.messages

    expect(converted.length).toBe(3)
    expect(converted[2].role).toBe("tool")
    expect(converted[2].content).toContain("Action denied")
  })

  it("falls back to reasoning_content when content is empty", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "", reasoning_content: "I think I should..." } }],
      }),
    })
    const provider = new RealLLMProvider({ baseURL: "https://api.example.com/v1", model: "test", apiKey: "sk" })
    const response = await provider.complete([{ role: "user", content: "test" }])
    expect(response.text).toBe("I think I should...")
  })

  it("returns empty string when both content and reasoning_content are empty", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "" } }],
      }),
    })
    const provider = new RealLLMProvider({ baseURL: "https://api.example.com/v1", model: "test", apiKey: "sk" })
    const response = await provider.complete([{ role: "user", content: "test" }])
    expect(response.text).toBe("")
  })

  it("throws on API error status", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    })
    const provider = new RealLLMProvider({ baseURL: "https://api.example.com/v1", model: "test", apiKey: "bad-key" })
    await expect(provider.complete([{ role: "user", content: "test" }])).rejects.toThrow("LLM API error 401")
  })

  it("handles malformed tool arguments JSON gracefully", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: {
          content: "trying",
          tool_calls: [{ function: { name: "file_write", arguments: "not json" } }],
        } }],
      }),
    })
    const provider = new RealLLMProvider({ baseURL: "https://api.example.com/v1", model: "test", apiKey: "sk" })
    const response = await provider.complete([{ role: "user", content: "test" }])
    expect(response.action.type).toBe("call_tool")
    expect(response.action.args).toEqual({})
  })
})
