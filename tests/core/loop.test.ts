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
import { AgentState } from "../../src/core/types"

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

  it("handles take_note action and writes to memory", async () => {
    const harness = buildTestHarness([
      { text: "noted", action: { type: "take_note", note: "important info" } },
      { text: "Done", action: { type: "done" } },
    ], dir)
    const result = await harness.run("take note")
    expect(result.answer).toBe("Done")
    expect(result.steps).toBe(2)
  })

  it("handles unknown tool gracefully", async () => {
    const harness = buildTestHarness([
      { text: "trying", action: { type: "call_tool", tool: "unknown_tool", args: {} } },
      { text: "Done", action: { type: "done" } },
    ], dir)
    const result = await harness.run("use unknown tool")
    expect(result.answer).toBe("Done")
    expect(result.steps).toBe(2)
  })

  it("runs sensors when code changed", async () => {
    const harness = buildTestHarness([
      { text: "writing", action: { type: "call_tool", tool: "file_write", args: { path: join(dir, "x.ts"), content: "code" }, changedCode: true } },
      { text: "Done", action: { type: "done" } },
    ], dir)

    const config = { ...harness.getConfig(), sensors: { test: "echo test-ok", lint: "", typecheck: "" } }
    harness.setConfig(config)

    const result = await harness.run("write code")
    expect(result.answer).toBe("Done")
    expect(result.steps).toBe(2)
    const feedbackEvents = harness.tracer.export().filter(e => e.type === "feedback")
    expect(feedbackEvents.length).toBeGreaterThan(0)
  })

  it("throws when LLM is undefined", async () => {
    const deps = {
      llm: undefined as any,
      config: {
        llm: { provider: "mock", model: "mock", baseURL: "" },
        tools: [], policies: "", sensors: { test: "", lint: "", typecheck: "" },
        sandbox: { timeout: 30, maxMemory: 512 }, maxSteps: 50, timeout: 300,
      } as Config,
      policyEngine: new PolicyEngine([]),
      hitl: new HitlStateMachine(),
      sandbox: new Sandbox(dir, { timeout: 30, maxMemory: 512 }),
      feedback: new FeedbackValidator({ test: "", lint: "", typecheck: "" }),
      memory: new MemoryStore(join(dir, "mem.json")),
      tracer: new Tracer(),
      tools: {} as Record<string, any>,
    }
    const harness = new Harness(deps)
    await expect(harness.run("test")).rejects.toThrow("LLM provider not configured")
  })

  it("completes after HITL approval on ask decision", async () => {
    const askPolicies: Policy[] = [
      { name: "force-push", type: "command_pattern", pattern: "git\\s+push.*--force", decision: "ask", message: "需要确认" },
    ]
    const config: Config = {
      llm: { provider: "mock", model: "mock", baseURL: "" },
      tools: ["shell_exec"], policies: "",
      sensors: { test: "", lint: "", typecheck: "" },
      sandbox: { timeout: 30, maxMemory: 512 }, maxSteps: 50, timeout: 300,
    }
    const hitl = new HitlStateMachine()
    const harness = new Harness({
      llm: new MockLLMProvider([
        { text: "pushing", action: { type: "call_tool", tool: "shell_exec", args: { command: "git push --force" } } },
        { text: "Done", action: { type: "done" } },
      ]),
      config,
      policyEngine: new PolicyEngine(askPolicies),
      hitl,
      sandbox: new Sandbox(dir, { timeout: 30, maxMemory: 512 }),
      feedback: new FeedbackValidator(config.sensors),
      memory: new MemoryStore(join(dir, "mem.json")),
      tracer: new Tracer(),
      tools: { file_read: fileRead, file_write: fileWrite, file_delete: fileWrite, shell_exec: shellExec, run_test: runTest } as any,
    })

    const runPromise = harness.run("push code")
    await new Promise(r => setTimeout(r, 50))
    expect(hitl.getState()).toBe(AgentState.PendingApproval)

    hitl.approve()
    const result = await runPromise
    expect(result.answer).toBe("Done")
    expect(result.steps).toBe(2)
  })

  it("injects memory into context on subsequent runs", async () => {
    const harness = buildTestHarness([
      { text: "Done1", action: { type: "done" } },
    ], dir)
    await harness.run("first task")

    const mock2 = new MockLLMProvider([
      { text: "Done2", action: { type: "done" } },
    ])
    const harness2 = new Harness({
      llm: mock2,
      config: harness.getConfig(),
      policyEngine: new PolicyEngine([]),
      hitl: new HitlStateMachine(),
      sandbox: new Sandbox(dir, { timeout: 30, maxMemory: 512 }),
      feedback: new FeedbackValidator({ test: "", lint: "", typecheck: "" }),
      memory: new MemoryStore(join(dir, "memory.json")),
      tracer: new Tracer(),
      tools: {} as any,
    })
    const result = await harness2.run("second task")
    expect(result.answer).toBe("Done2")
  })

  it("stops after 3 consecutive governance denies", async () => {
    const denyPolicies: Policy[] = [
      { name: "block-read", type: "command_pattern", pattern: "cat\\s+/etc/passwd", decision: "deny", message: "blocked" },
    ]
    const config: Config = {
      llm: { provider: "mock", model: "mock", baseURL: "" },
      tools: ["shell_exec"], policies: "",
      sensors: { test: "", lint: "", typecheck: "" },
      sandbox: { timeout: 30, maxMemory: 512 }, maxSteps: 50, timeout: 300,
    }
    const responses = [
      { text: "trying 1", action: { type: "call_tool", tool: "shell_exec", args: { command: "cat /etc/passwd" } } },
      { text: "trying 2", action: { type: "call_tool", tool: "shell_exec", args: { command: "cat /etc/passwd" } } },
      { text: "trying 3", action: { type: "call_tool", tool: "shell_exec", args: { command: "cat /etc/passwd" } } },
      { text: "should not reach", action: { type: "done" } },
    ]
    const harness = new Harness({
      llm: new MockLLMProvider(responses),
      config,
      policyEngine: new PolicyEngine(denyPolicies),
      hitl: new HitlStateMachine(),
      sandbox: new Sandbox(dir, { timeout: 30, maxMemory: 512 }),
      feedback: new FeedbackValidator(config.sensors),
      memory: new MemoryStore(join(dir, "mem.json")),
      tracer: new Tracer(),
      tools: { file_read: fileRead, file_write: fileWrite, file_delete: fileWrite, shell_exec: shellExec, run_test: runTest } as any,
    })
    const result = await harness.run("read passwd")
    expect(result.steps).toBe(3)
    expect(result.answer).toContain("Security")
    expect(harness.tracer.getDenials()).toHaveLength(3)
  })
})
