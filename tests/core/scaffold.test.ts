import { describe, it, expect } from "vitest"
import type { Message, Action, ToolResult, GuardrailDecision, Policy, FeedbackReport, Failure, FailureCategory, AgentState, TraceEvent, AgentResult, Config } from "../../src/core/types"

describe("scaffold", () => {
  it("exports all shared types", () => {
    const msg: Message = { role: "user", content: "hello" }
    expect(msg.role).toBe("user")
  })

  it("Action call_tool has tool and args", () => {
    const action: Action = { type: "call_tool", tool: "file_read", args: { path: "/tmp/a.ts" } }
    expect(action.type).toBe("call_tool")
  })

  it("GuardrailDecision is allow/deny/ask", () => {
    const d: GuardrailDecision = "deny"
    expect(["allow", "deny", "ask"]).toContain(d)
  })
})
