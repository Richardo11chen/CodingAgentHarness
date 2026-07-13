import { describe, it, expect } from "vitest"
import { PolicyEngine } from "../../../src/core/governance/policy"
import type { Policy, Action } from "../../../src/core/types"

const policies: Policy[] = [
  { name: "no-rm-rf", type: "command_pattern", pattern: "rm\\s+.*-r?f?.*/", decision: "deny", message: "no rm -rf" },
  { name: "force-push", type: "command_pattern", pattern: "git\\s+push.*--force", decision: "ask", message: "force push needs approval" },
  { name: "env-protect", type: "path_pattern", pattern: "**/.env", decision: "ask", message: "env file modification needs approval" },
  { name: "project-only", type: "path_boundary", pattern: ".", decision: "deny", message: "outside project dir" },
]

describe("PolicyEngine", () => {
  const engine = new PolicyEngine(policies)

  it("denies rm -rf /", () => {
    const action: Action = { type: "call_tool", tool: "shell_exec", args: { command: "rm -rf /" } }
    const result = engine.evaluate(action)
    expect(result.decision).toBe("deny")
    expect(result.policy?.name).toBe("no-rm-rf")
  })

  it("asks for git push --force", () => {
    const action: Action = { type: "call_tool", tool: "shell_exec", args: { command: "git push --force origin main" } }
    const result = engine.evaluate(action)
    expect(result.decision).toBe("ask")
    expect(result.policy?.name).toBe("force-push")
  })

  it("asks for .env file write", () => {
    const action: Action = { type: "call_tool", tool: "file_write", args: { path: ".env", content: "KEY=val" } }
    const result = engine.evaluate(action)
    expect(result.decision).toBe("ask")
    expect(result.policy?.name).toBe("env-protect")
  })

  it("allows safe command", () => {
    const action: Action = { type: "call_tool", tool: "shell_exec", args: { command: "echo hello" } }
    const result = engine.evaluate(action)
    expect(result.decision).toBe("allow")
  })

  it("allows when no policies match", () => {
    const emptyEngine = new PolicyEngine([])
    const action: Action = { type: "call_tool", tool: "file_read", args: { path: "src/a.ts" } }
    const result = emptyEngine.evaluate(action)
    expect(result.decision).toBe("allow")
  })
})
