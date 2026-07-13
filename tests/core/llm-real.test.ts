import { describe, it, expect, vi } from "vitest"
import { RealLLMProvider } from "../../src/core/llm"

// Mock global fetch
global.fetch = vi.fn()

describe("RealLLMProvider", () => {
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
})
