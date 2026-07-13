// tests/demo/guardrail-demo.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { Harness } from "../../src/core/loop"
import { MockLLMProvider } from "../../src/core/llm"
import { PolicyEngine } from "../../src/core/governance/policy"
import { HitlStateMachine } from "../../src/core/governance/hitl"
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

describe("Demo ①: Guardrail intercepts dangerous action", () => {
  let dir: string
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "demo-g-")) })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it("denies rm -rf / and feeds back to agent", async () => {
    const policies: Policy[] = [
      { name: "no-rm-rf", type: "command_pattern", pattern: "rm\\s+.*-r?f?.*/", decision: "deny", message: "禁止删除根目录" },
    ]
    const config: Config = {
      llm: { provider: "mock", model: "mock", baseURL: "" },
      tools: ["shell_exec"], policies: "",
      sensors: { test: "", lint: "", typecheck: "" },
      sandbox: { timeout: 30, maxMemory: 512 }, maxSteps: 50, timeout: 300,
    }
    const mock = new MockLLMProvider([
      { text: "deleting", action: { type: "call_tool", tool: "shell_exec", args: { command: "rm -rf /" } } },
      { text: "understood, I won't delete", action: { type: "done" } },
    ])
    const harness = new Harness({
      llm: mock, config,
      policyEngine: new PolicyEngine(policies),
      hitl: new HitlStateMachine(),
      sandbox: new Sandbox(dir, { timeout: 30, maxMemory: 512 }),
      feedback: new FeedbackValidator(config.sensors),
      memory: new MemoryStore(join(dir, "mem.json")),
      tracer: new Tracer(),
      tools: { file_read: fileRead, file_write: fileWrite, file_delete: fileWrite, shell_exec: shellExec, run_test: runTest } as any,
    })
    const result = await harness.run("delete everything")
    expect(harness.tracer.getDenials()).toHaveLength(1)
    expect(result.answer).toBe("understood, I won't delete")
  })
})
