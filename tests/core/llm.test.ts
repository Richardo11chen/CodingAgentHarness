import { describe, it, expect } from "vitest"
import { MockLLMProvider } from "../../src/core/llm"
import type { Message } from "../../src/core/types"

describe("MockLLMProvider", () => {
  it("returns pre-programmed responses in order", async () => {
    const mock = new MockLLMProvider([
      { text: "I'll read the file", action: { type: "call_tool", tool: "file_read", args: { path: "a.ts" } } },
      { text: "Done", action: { type: "done" } },
    ])
    const messages: Message[] = [{ role: "user", content: "read a.ts" }]

    const r1 = await mock.complete(messages)
    expect(r1.text).toBe("I'll read the file")
    expect(r1.action.type).toBe("call_tool")

    const r2 = await mock.complete(messages)
    expect(r2.action.type).toBe("done")
  })

  it("returns done when responses exhausted", async () => {
    const mock = new MockLLMProvider([])
    const r = await mock.complete([])
    expect(r.action.type).toBe("done")
  })
})
