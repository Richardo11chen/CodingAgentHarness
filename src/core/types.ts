export interface Message {
  role: "system" | "user" | "assistant"
  content: string
  action?: Action
}

export type ActionType = "call_tool" | "done" | "take_note"

export interface Action {
  type: ActionType
  tool?: string
  args?: ToolArgs
  changedCode?: boolean
  text?: string
  note?: string
}

export interface ToolArgs {
  path?: string
  content?: string
  command?: string
}

export interface ToolResult {
  success: boolean
  content?: string
  stdout?: string
  stderr?: string
  exitCode?: number
  error?: string
}

export type GuardrailDecision = "allow" | "deny" | "ask"

export type PolicyType = "command_pattern" | "path_boundary" | "path_pattern"

export interface Policy {
  name: string
  type: PolicyType
  pattern: string
  decision: GuardrailDecision
  message: string
  except?: string
}

export type FailureCategory = "syntax_error" | "test_failure" | "type_error" | "lint_violation" | "unknown"

export interface Failure {
  message: string
  file?: string
  line?: number
}

export interface FeedbackReport {
  passed: boolean
  failures: Failure[]
  category: FailureCategory
  rawOutput: string
}

export enum AgentState {
  Running = "running",
  PendingApproval = "pending_approval",
  Stopped = "stopped",
}

export type TraceEventType =
  | "thinking" | "action" | "governance" | "tool_start"
  | "tool_result" | "feedback" | "approval_request" | "step" | "done" | "error"

export interface TraceEvent {
  timestamp: number
  type: TraceEventType
  data: unknown
}

export interface AgentResult {
  answer: string | null
  steps: number
  trace: TraceEvent[]
}

export interface Config {
  llm: { provider: string; model: string; baseURL: string }
  tools: string[]
  policies: string
  sensors: { test: string; lint: string; typecheck: string }
  sandbox: { timeout: number; maxMemory: number }
  maxSteps: number
  timeout: number
}

export interface LLMResponse {
  text: string
  action: Action
}

export interface LLMOptions {
  model?: string
  temperature?: number
  maxTokens?: number
}
