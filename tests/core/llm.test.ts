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
    const mock = new MockLLMProvider([{ text: "only", action: { type: "done" } }])
    const r1 = await mock.complete([])
    expect(r1.text).toBe("only")
    const r2 = await mock.complete([])
    expect(r2.action.type).toBe("done")
    expect(r2.text).toBe("done")
  })

  it("returns responses in FIFO order", async () => {
    const mock = new MockLLMProvider([
      { text: "first", action: { type: "done" } },
      { text: "second", action: { type: "done" } },
    ])
    expect((await mock.complete([])).text).toBe("first")
    expect((await mock.complete([])).text).toBe("second")
  })

  it("does not mutate passed messages", async () => {
    const mock = new MockLLMProvider([{ text: "ok", action: { type: "done" } }])
    const msgs = [{ role: "user" as const, content: "test" }]
    await mock.complete(msgs)
    expect(msgs.length).toBe(1)
  })
})
