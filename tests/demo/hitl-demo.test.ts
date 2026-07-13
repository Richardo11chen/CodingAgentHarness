// tests/demo/hitl-demo.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { Harness } from "../../src/core/loop"
import { MockLLMProvider } from "../../src/core/llm"
import { HitlStateMachine } from "../../src/core/governance/hitl"
import { AgentState } from "../../src/core/types"
import { PolicyEngine } from "../../src/core/governance/policy"
import { Sandbox } from "../../src/core/governance/sandbox"
import { FeedbackValidator } from "../../src/core/feedback/validator"
import { MemoryStore } from "../../src/core/memory"
import { Tracer } from "../../src/core/tracer"
import { fileRead, fileWrite } from "../../src/core/tools/file"
import { shellExec } from "../../src/core/tools/shell"
import { runTest } from "../../src/core/tools/test-runner"
import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import type { Policy, Config } from "../../src/core/types"

describe("Demo ③: HITL approval flow", () => {
  let dir: string
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "demo-h-")) })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it("pauses on ask, resumes after approve", async () => {
    const policies: Policy[] = [
      { name: "force-push", type: "command_pattern", pattern: "git\\s+push.*--force", decision: "ask", message: "强制推送需要确认" },
    ]
    const config: Config = {
      llm: { provider: "mock", model: "mock", baseURL: "" },
      tools: ["shell_exec"], policies: "",
      sensors: { test: "", lint: "", typecheck: "" },
      sandbox: { timeout: 30, maxMemory: 512 }, maxSteps: 50, timeout: 300,
    }
    const mock = new MockLLMProvider([
      { text: "pushing", action: { type: "call_tool", tool: "shell_exec", args: { command: "git push --force" } } },
      { text: "Done", action: { type: "done" } },
    ])
    const hitl = new HitlStateMachine()
    const harness = new Harness({
      llm: mock, config,
      policyEngine: new PolicyEngine(policies),
      hitl,
      sandbox: new Sandbox(dir, { timeout: 30, maxMemory: 512 }),
      feedback: new FeedbackValidator(config.sensors),
      memory: new MemoryStore(join(dir, "mem.json")),
      tracer: new Tracer(),
      tools: { file_read: fileRead, file_write: fileWrite, file_delete: fileWrite, shell_exec: shellExec, run_test: runTest } as any,
    })

    // Run in background
    const runPromise = harness.run("push code")

    // Wait a tick for the loop to hit the approval
    await new Promise((r) => setTimeout(r, 100))

    // Verify state machine is paused
    expect(hitl.getState()).toBe(AgentState.PendingApproval)

    // Approve
    hitl.approve()

    const result = await runPromise
    expect(result.answer).toBe("Done")
  })
})
