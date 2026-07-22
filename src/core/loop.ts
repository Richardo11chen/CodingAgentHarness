import type { LLMProvider } from "./llm.js"
import type { Config, Message, Action, ToolResult, AgentResult, TraceEvent } from "./types.js"
import { PolicyEngine } from "./governance/policy.js"
import { HitlStateMachine } from "./governance/hitl.js"
import { AgentState } from "./types.js"
import { Sandbox } from "./governance/sandbox.js"
import { FeedbackValidator } from "./feedback/validator.js"
import { MemoryStore } from "./memory.js"
import { Tracer } from "./tracer.js"
import type { Tool } from "./tools/file.js"
import { shellExec } from "./tools/shell.js"

export interface HarnessDeps {
  llm: LLMProvider | undefined
  config: Config
  policyEngine: PolicyEngine
  hitl: HitlStateMachine
  sandbox: Sandbox
  feedback: FeedbackValidator
  memory: MemoryStore
  tracer: Tracer
  tools: Record<string, Tool>
}

export class Harness {
  private deps: HarnessDeps
  private systemPrompt: string

  constructor(deps: HarnessDeps) {
    this.deps = deps
    this.systemPrompt = "You are a coding agent. You are NOT Claude or ChatGPT. Use tools: file_read, file_write, file_delete, shell_exec, run_test. When done, output a summary and stop."
  }

  getConfig(): Config { return this.deps.config }
  setConfig(config: Config) { this.deps.config = config }
  get tracer() { return this.deps.tracer }
  get hitl() { return this.deps.hitl }

  async run(goal: string): Promise<AgentResult> {
    const { llm, config, policyEngine, hitl, sandbox, feedback, memory, tracer, tools } = this.deps

    let context: Message[] = [
      { role: "system", content: this.systemPrompt },
      { role: "user", content: goal },
    ]

    const memResults = memory.read(goal)
    if (memResults.length > 0) {
      context.splice(1, 0, { role: "system", content: `Memory: ${memResults.join("; ")}` })
    }

    let steps = 0
    let answer: string | null = null
    let consecutiveDenies = 0
    const MAX_DENIES = 3

    while (steps < config.maxSteps && hitl.getState() !== AgentState.Stopped) {
      steps++
      tracer.record({ type: "step", data: { step: steps } })

      if (!llm) throw new Error("LLM provider not configured")
      const response = await llm.complete(context, undefined, config.timeout * 1000)
      tracer.record({ type: "thinking", data: { text: response.text } })

      const assistantMsg: Message = { role: "assistant", content: response.text, action: response.action }
      if (response.reasoning_content !== undefined) {
        assistantMsg.reasoning_content = response.reasoning_content
      }
      context.push(assistantMsg)

      if (response.action.type === "call_tool" && response.action.tool === "done") {
        answer = response.text
        tracer.record({ type: "done", data: { answer } })
        break
      }

      if (response.action.type === "done") {
        answer = response.text
        tracer.record({ type: "done", data: { answer } })
        break
      }

      if (response.action.type === "take_note") {
        memory.write(response.action.note ?? "")
        continue
      }

      tracer.record({ type: "action", data: response.action })

      if (response.action.type === "call_tool") {
        const govResult = policyEngine.evaluate(response.action)
        tracer.record({ type: "governance", data: govResult })

        if (govResult.decision === "deny") {
          consecutiveDenies++
          if (consecutiveDenies >= MAX_DENIES) {
            answer = "Security: Too many denied actions. Stopping."
            tracer.record({ type: "done", data: { answer } })
            break
          }
          context.push({ role: "user", content: `Tool result: Action denied - ${govResult.policy?.message ?? "policy violation"}. Do NOT retry or find alternatives; this operation is not allowed.` })
          continue
        }

        consecutiveDenies = 0

        if (govResult.decision === "ask") {
          hitl.requestApproval(response.action)
          tracer.record({ type: "approval_request", data: { action: response.action, policy: govResult.policy } })
          const approvedAction = await hitl.waitForApproval()
          if (approvedAction) {
            consecutiveDenies = 0
            const result = await sandbox.run(tools[approvedAction.tool ?? ""], approvedAction.args ?? {})
            tracer.record({ type: "tool_result", data: result })
            context.push({ role: "user", content: `Tool result: ${JSON.stringify(result)}` })
          } else {
            consecutiveDenies++
            if (consecutiveDenies >= MAX_DENIES) {
              answer = "Security: Too many denied actions. Stopping."
              tracer.record({ type: "done", data: { answer } })
              break
            }
            context.push({ role: "user", content: `Tool result: Action denied - ${govResult.policy?.message ?? ""}. Do NOT retry or find alternatives; this operation is not allowed.` })
          }
          continue
        }

        // Execute via sandbox
        tracer.record({ type: "tool_start", data: { tool: response.action.tool, args: response.action.args } })
        const tool = tools[response.action.tool ?? ""]
        if (!tool) {
          context.push({ role: "user", content: `Tool result: unknown tool "${response.action.tool}"` })
          continue
        }
        const result = await sandbox.run(tool, response.action.args ?? {})
        tracer.record({ type: "tool_result", data: result })
        context.push({ role: "user", content: `Tool result: ${JSON.stringify(result)}` })

        // Feedback if code changed
        if (response.action.changedCode) {
          const sensorCommands = [config.sensors.test, config.sensors.lint, config.sensors.typecheck].filter(Boolean)
          for (const command of sensorCommands) {
            const sensorResult = await shellExec({ command })
            const report = feedback.validate(sensorResult)
            tracer.record({ type: "feedback", data: report })
            context.push({ role: "user", content: `Feedback: ${JSON.stringify(report)}` })
          }
        }
      }
    }

    memory.consolidate(context.map((m) => m.content).join("\n"))
    return { answer, steps, trace: tracer.export() }
  }
}
