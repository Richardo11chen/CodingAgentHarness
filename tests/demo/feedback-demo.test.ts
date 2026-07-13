// tests/demo/feedback-demo.test.ts
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
import type { Config } from "../../src/core/types"

describe("Demo ②: Feedback loop drives correction", () => {
  let dir: string
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "demo-f-")) })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it("agent receives test failure feedback and corrects", async () => {
    const config: Config = {
      llm: { provider: "mock", model: "mock", baseURL: "" },
      tools: ["file_write", "run_test"], policies: "",
      sensors: { test: 'echo "FAIL: assertion error" && exit 1', lint: "", typecheck: "" },
      sandbox: { timeout: 30, maxMemory: 512 }, maxSteps: 50, timeout: 300,
    }
    const mock = new MockLLMProvider([
      { text: "writing code", action: { type: "call_tool", tool: "file_write", args: { path: join(dir, "a.ts"), content: "bad code" }, changedCode: true } },
      { text: "fixing code", action: { type: "call_tool", tool: "file_write", args: { path: join(dir, "a.ts"), content: "good code" }, changedCode: true } },
      { text: "Done", action: { type: "done" } },
    ])
    const harness = new Harness({
      llm: mock, config,
      policyEngine: new PolicyEngine([]),
      hitl: new HitlStateMachine(),
      sandbox: new Sandbox(dir, { timeout: 30, maxMemory: 512 }),
      feedback: new FeedbackValidator(config.sensors),
      memory: new MemoryStore(join(dir, "mem.json")),
      tracer: new Tracer(),
      tools: { file_read: fileRead, file_write: fileWrite, file_delete: fileWrite, shell_exec: shellExec, run_test: runTest } as any,
    })
    const result = await harness.run("fix the code")
    expect(harness.tracer.getFeedbackReports().length).toBeGreaterThanOrEqual(1)
    expect(result.steps).toBe(3)
  })
})
