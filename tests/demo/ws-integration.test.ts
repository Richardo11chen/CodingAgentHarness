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
import type { TraceEvent, Policy, Config } from "../../src/core/types"

describe("Demo ④: Tracer event emission", () => {
  let dir: string
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "demo-t-")) })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it("emits step, thinking, action, tool_result, done events in order", async () => {
    const config: Config = {
      llm: { provider: "mock", model: "mock", baseURL: "" },
      tools: ["file_read"], policies: "",
      sensors: { test: "", lint: "", typecheck: "" },
      sandbox: { timeout: 30, maxMemory: 512 }, maxSteps: 50, timeout: 300,
    }
    const mock = new MockLLMProvider([
      { text: "reading", action: { type: "call_tool", tool: "file_read", args: { path: join(dir, "test.ts") } } },
      { text: "Done", action: { type: "done" } },
    ])
    
    const events: TraceEvent[] = []
    const tracer = new Tracer(500, (event) => events.push(event))
    
    const harness = new Harness({
      llm: mock, config,
      policyEngine: new PolicyEngine([]),
      hitl: new HitlStateMachine(),
      sandbox: new Sandbox(dir, { timeout: 30, maxMemory: 512 }),
      feedback: new FeedbackValidator(config.sensors),
      memory: new MemoryStore(join(dir, "mem.json")),
      tracer,
      tools: { file_read: fileRead, file_write: fileWrite, file_delete: fileWrite, shell_exec: shellExec, run_test: runTest } as any,
    })

    const result = await harness.run("read test.ts")
    expect(result.answer).toBe("Done")
    
    // 验证事件顺序
    const types = events.map(e => e.type)
    expect(types).toContain("step")
    expect(types).toContain("thinking")
    expect(types).toContain("action")
    expect(types).toContain("tool_start")
    expect(types).toContain("tool_result")
    expect(types).toContain("done")
    
    // step 应该在 thinking 之前
    const stepIdx = types.indexOf("step")
    const thinkingIdx = types.indexOf("thinking")
    expect(stepIdx).toBeLessThan(thinkingIdx)
    
    // done 应该在最后
    const doneIdx = types.lastIndexOf("done")
    expect(doneIdx).toBeGreaterThan(thinkingIdx)
  })

  it("emits governance deny events", async () => {
    const policies: Policy[] = [
      { name: "no-rm", type: "command_pattern", pattern: "rm\\s+.*/", decision: "deny", message: "no rm" },
    ]
    const config: Config = {
      llm: { provider: "mock", model: "mock", baseURL: "" },
      tools: ["shell_exec"], policies: "",
      sensors: { test: "", lint: "", typecheck: "" },
      sandbox: { timeout: 30, maxMemory: 512 }, maxSteps: 50, timeout: 300,
    }
    const mock = new MockLLMProvider([
      { text: "deleting", action: { type: "call_tool", tool: "shell_exec", args: { command: "rm -rf /" } } },
      { text: "ok", action: { type: "done" } },
    ])
    
    const events: TraceEvent[] = []
    const tracer = new Tracer(500, (event) => events.push(event))
    
    const harness = new Harness({
      llm: mock, config,
      policyEngine: new PolicyEngine(policies),
      hitl: new HitlStateMachine(),
      sandbox: new Sandbox(dir, { timeout: 30, maxMemory: 512 }),
      feedback: new FeedbackValidator(config.sensors),
      memory: new MemoryStore(join(dir, "mem.json")),
      tracer,
      tools: { file_read: fileRead, file_write: fileWrite, file_delete: fileWrite, shell_exec: shellExec, run_test: runTest } as any,
    })

    await harness.run("delete everything")
    
    const govEvents = events.filter(e => e.type === "governance")
    expect(govEvents.length).toBeGreaterThan(0)
    expect((govEvents[0].data as any).decision).toBe("deny")
  })

  it("emits approval_request events for ask decisions", async () => {
    const policies: Policy[] = [
      { name: "ask-push", type: "command_pattern", pattern: "git\\s+push.*--force", decision: "ask", message: "需要确认" },
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
    
    const events: TraceEvent[] = []
    const tracer = new Tracer(500, (event) => events.push(event))
    const hitl = new HitlStateMachine()
    
    const harness = new Harness({
      llm: mock, config,
      policyEngine: new PolicyEngine(policies),
      hitl,
      sandbox: new Sandbox(dir, { timeout: 30, maxMemory: 512 }),
      feedback: new FeedbackValidator(config.sensors),
      memory: new MemoryStore(join(dir, "mem.json")),
      tracer,
      tools: { file_read: fileRead, file_write: fileWrite, file_delete: fileWrite, shell_exec: shellExec, run_test: runTest } as any,
    })

    const runPromise = harness.run("push code")
    await new Promise(r => setTimeout(r, 50))
    
    const approvalEvents = events.filter(e => e.type === "approval_request")
    expect(approvalEvents.length).toBeGreaterThan(0)
    
    hitl.approve()
    await runPromise
  })

  it("tracer respects maxEvents limit", async () => {
    const tracer = new Tracer(3) // 只保留 3 个事件
    
    tracer.record({ type: "step", data: { step: 1 } })
    tracer.record({ type: "step", data: { step: 2 } })
    tracer.record({ type: "step", data: { step: 3 } })
    tracer.record({ type: "step", data: { step: 4 } })
    
    const exported = tracer.export()
    expect(exported.length).toBe(3)
    // 最早的事件应被移除
    expect((exported[0].data as any).step).toBe(2)
  })
})
