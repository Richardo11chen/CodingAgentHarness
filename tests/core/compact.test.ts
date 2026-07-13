import { describe, it, expect } from "vitest"
import { compactContext } from "../../src/core/compact"
import { MockLLMProvider } from "../../src/core/llm"
import type { Message } from "../../src/core/types"

describe("compactContext", () => {
  it("summarizes old messages, keeps recent ones", async () => {
    const messages: Message[] = [
      { role: "system", content: "system prompt" },
      { role: "user", content: "old message 1" },
      { role: "assistant", content: "old reply 1" },
      { role: "user", content: "old message 2" },
      { role: "assistant", content: "old reply 2" },
      { role: "user", content: "recent message" },
    ]
    const mock = new MockLLMProvider([
      { text: "Summary of previous conversation", action: { type: "done" } },
    ])
    const result = await compactContext(messages, mock, { keepRecent: 2, tokenLimit: 10 })
    expect(result[0].role).toBe("system")
    expect(result.some((m) => m.content.includes("Summary"))).toBe(true)
    expect(result.some((m) => m.content === "recent message")).toBe(true)
    expect(result.length).toBeLessThan(messages.length)
  })

  it("does not compact when under limit", async () => {
    const messages: Message[] = [
      { role: "system", content: "sys" },
      { role: "user", content: "hi" },
    ]
    const mock = new MockLLMProvider([])
    const result = await compactContext(messages, mock, { keepRecent: 5, tokenLimit: 10000 })
    expect(result).toEqual(messages)
  })
})
