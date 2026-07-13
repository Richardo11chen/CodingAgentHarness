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
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import type { Policy, Config } from "../../src/core/types"

const policies: Policy[] = [
  { name: "no-rm-rf", type: "command_pattern", pattern: "rm\\s+.*-r?f?.*/", decision: "deny", message: "no rm -rf" },
]

function buildTestHarness(mockResponses: any[], dir: string): Harness {
  const mock = new MockLLMProvider(mockResponses)
  const config: Config = {
    llm: { provider: "mock", model: "mock", baseURL: "" },
    tools: ["file_read", "file_write", "shell_exec", "run_test"],
    policies: "",
    sensors: { test: "npm test", lint: "eslint", typecheck: "tsc" },
    sandbox: { timeout: 30, maxMemory: 512 },
    maxSteps: 50,
    timeout: 300,
  }
  return new Harness({
    llm: mock,
    config,
    policyEngine: new PolicyEngine(policies),
    hitl: new HitlStateMachine(),
    sandbox: new Sandbox(dir, { timeout: 30, maxMemory: 512 }),
    feedback: new FeedbackValidator(config.sensors),
    memory: new MemoryStore(join(dir, "memory.json")),
    tracer: new Tracer(),
    tools: { file_read: fileRead, file_write: fileWrite, file_delete: fileWrite, shell_exec: shellExec, run_test: runTest },
  })
}

describe("Harness agent loop", () => {
  let dir: string
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "loop-")) })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it("completes a simple goal with done action", async () => {
    const harness = buildTestHarness([
      { text: "Done!", action: { type: "done" } },
    ], dir)
    const result = await harness.run("say done")
    expect(result.answer).toBe("Done!")
    expect(result.steps).toBe(1)
  })

  it("executes file_read then done", async () => {
    writeFileSync(join(dir, "a.ts"), "hello")
    const harness = buildTestHarness([
      { text: "reading", action: { type: "call_tool", tool: "file_read", args: { path: join(dir, "a.ts") } } },
      { text: "Done", action: { type: "done" } },
    ], dir)
    const result = await harness.run("read a.ts")
    expect(result.answer).toBe("Done")
    expect(result.steps).toBe(2)
    expect(harness.tracer.getActions()).toHaveLength(1)
  })

  it("guardrail denies dangerous command", async () => {
    const harness = buildTestHarness([
      { text: "deleting", action: { type: "call_tool", tool: "shell_exec", args: { command: "rm -rf /" } } },
      { text: "ok", action: { type: "done" } },
    ], dir)
    const result = await harness.run("delete everything")
    expect(harness.tracer.getDenials()).toHaveLength(1)
    expect(result.steps).toBe(2)
  })

  it("stops at max steps", async () => {
    const responses = Array(60).fill({ text: "loop", action: { type: "call_tool", tool: "file_read", args: { path: join(dir, "a.ts") } } })
    const harness = buildTestHarness(responses, dir)
    const config = { ...harness.getConfig(), maxSteps: 3 }
    harness.setConfig(config)
    const result = await harness.run("loop forever")
    expect(result.steps).toBe(3)
    expect(result.answer).toBeNull()
  })
})
