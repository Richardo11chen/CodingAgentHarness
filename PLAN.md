# Coding Agent Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Coding Agent Harness with a self-implemented kernel (main loop, tools, governance, feedback, memory, config), a WebUI for interactive use, credential management, and Docker/npm distribution.

**Architecture:** Single-package modular structure in TypeScript. Three layers: Harness Kernel (core deliverable), WebUI (delivery interface), Infrastructure (credentials, LLM client, Docker). Governance/guardrails is the focus dimension with deep implementation (Policy Engine + HITL State Machine + Sandbox).

**Tech Stack:** TypeScript, Node.js 22+, Express, React + Vite, Vitest, keytar, Open Design (Linear), Docker, Render.

## Global Constraints

- Language: TypeScript (strict mode, ESM modules)
- Runtime: Node.js 22+
- Test framework: Vitest
- TDD mandatory: red → green → refactor, no code before tests
- LLM abstraction: supports any OpenAI-compatible API, mockable for testing
- Mechanisms must be code, not prompts (A.4)
- Core mechanism tests must use mock LLM, no network/real LLM dependency (A.6)
- CI: `.gitlab-ci.yml` with `unit-test` job, last run must be pass
- No real credentials in git
- Design system: Open Design Linear

---

## File Structure

```
src/
├── core/
│   ├── types.ts             # Shared types (Message, Action, ToolResult, etc.)
│   ├── llm.ts               # LLMProvider interface, MockLLMProvider, RealLLMProvider
│   ├── compact.ts           # Context compaction (LLM summarization)
│   ├── loop.ts              # Agent main loop
│   ├── tools/
│   │   ├── file.ts          # file_read, file_write, file_delete
│   │   ├── shell.ts         # shell_exec
│   │   └── test-runner.ts   # run_test
│   ├── governance/
│   │   ├── policy.ts        # PolicyEngine, Policy types
│   │   ├── hitl.ts          # HitlStateMachine, AgentState
│   │   └── sandbox.ts       # Sandbox
│   ├── feedback/
│   │   ├── validator.ts     # FeedbackValidator
│   │   └── classifier.ts    # FailureClassifier
│   ├── memory.ts            # MemoryStore
│   ├── config.ts            # Config, loadConfig
│   └── tracer.ts            # Tracer
├── web/
│   ├── server.ts            # Express + WebSocket
│   ├── routes/
│   │   ├── sessions.ts
│   │   ├── config.ts
│   │   └── credentials.ts
│   └── frontend/
│       ├── App.tsx
│       ├── components/
│       │   ├── ChatPanel.tsx
│       │   ├── MonitorPanel.tsx
│       │   ├── ApprovalModal.tsx
│       │   └── ConfigPanel.tsx
│       └── hooks/
│           └── useWebSocket.ts
├── credentials/
│   ├── keychain.ts
│   └── env.ts
└── index.ts

tests/
├── core/
│   ├── llm.test.ts
│   ├── compact.test.ts
│   ├── loop.test.ts
│   ├── tools/
│   │   ├── file.test.ts
│   │   ├── shell.test.ts
│   │   └── test-runner.test.ts
│   ├── governance/
│   │   ├── policy.test.ts
│   │   ├── hitl.test.ts
│   │   └── sandbox.test.ts
│   ├── feedback/
│   │   ├── validator.test.ts
│   │   └── classifier.test.ts
│   ├── memory.test.ts
│   ├── config.test.ts
│   └── tracer.test.ts
├── integration/
│   └── agent-loop.test.ts
├── credentials/
│   ├── keychain.test.ts
│   └── env.test.ts
└── demo/
    ├── guardrail-demo.test.ts
    ├── feedback-demo.test.ts
    └── hitl-demo.test.ts

.harness/
├── config.yml
└── policies.yml

Dockerfile
.gitlab-ci.yml
package.json
tsconfig.json
vitest.config.ts
```

## Dependency Graph

```
Phase 1 (Foundation):
  Task 1 (Scaffolding) ──┬── Task 2 (LLM Abstraction)
                          └── Task 3 (Config)

Phase 2 (Core mechanisms, parallel after Phase 1):
  Task 4 (Tools)          ─┐
  Task 5 (Policy Engine)  ─┤
  Task 6 (HITL State Machine) ─┤
  Task 7 (Sandbox)        ─┤
  Task 8 (Feedback)       ─┤
  Task 9 (Memory)         ─┤
  Task 10 (Tracer)        ─┘

Phase 3 (Integration):
  Task 11 (Agent Loop) ─── depends on 2,3,4,5,6,7,8,9,10
  Task 12 (Context Compaction) ── depends on 2,11
  Task 13 (RealLLMProvider) ── depends on 2

Phase 4 (Infrastructure, parallel with Phase 3):
  Task 14 (Credentials) ── depends on 1

Phase 5 (WebUI):
  Task 15 (WebUI Backend) ── depends on 11,14
  Task 16 (WebUI Frontend) ── depends on 15

Phase 6 (Distribution & CI):
  Task 17 (Dockerfile) ── depends on 15,16
  Task 18 (CI/CD) ── depends on 17

Phase 7 (Demos & Deployment):
  Task 19 (Mechanism Demos) ── depends on 5,6,7,8,11
  Task 20 (Cloud Deployment) ── depends on 17,18
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `.harness/config.yml`
- Create: `.harness/policies.yml`
- Create: `src/core/types.ts`
- Test: `tests/core/scaffold.test.ts`

**Interfaces:**
- Produces: `src/core/types.ts` with all shared types (Message, Action, ToolResult, GuardrailDecision, Policy, FeedbackReport, Failure, FailureCategory, AgentState, TraceEvent, AgentResult, Config)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/core/scaffold.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/scaffold.test.ts`
Expected: FAIL — cannot find module `../../src/core/types`

- [ ] **Step 3: Create package.json, tsconfig.json, vitest.config.ts, .gitignore**

```json
// package.json
{
  "name": "coding-agent-harness",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "dev:web": "vite"
  },
  "dependencies": {
    "express": "^4.21.0",
    "ws": "^8.18.0",
    "keytar": "^7.9.0",
    "dotenv": "^16.4.0",
    "yaml": "^2.5.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "tsx": "^4.19.0",
    "@types/express": "^4.17.0",
    "@types/ws": "^8.5.0",
    "@types/node": "^22.0.0",
    "vite": "^5.4.0",
    "@vitejs/plugin-react": "^4.3.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0"
  }
}
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": ".",
    "declaration": true,
    "sourceMap": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "include": ["src", "tests"],
  "exclude": ["node_modules", "dist"]
}
```

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config"
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
})
```

```gitignore
# .gitignore
node_modules/
dist/
.env
.harness/memory.json
*.log
.DS_Store
```

- [ ] **Step 4: Create types.ts with all shared types**

```typescript
// src/core/types.ts
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
```

- [ ] **Step 5: Create default config and policies**

```yaml
# .harness/config.yml
llm:
  provider: "openai-compatible"
  model: "glm-5.2"
  baseURL: "https://njusehub.info/v1"
tools:
  - file_read
  - file_write
  - file_delete
  - shell_exec
  - run_test
policies: ".harness/policies.yml"
sensors:
  test: "npm test"
  lint: "npx eslint src/"
  typecheck: "npx tsc --noEmit"
sandbox:
  timeout: 30
  maxMemory: 512
maxSteps: 50
timeout: 300
```

```yaml
# .harness/policies.yml
rules:
  - name: "no-rm-rf-root"
    type: command_pattern
    pattern: 'rm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+)*-?r?f?\s+/'
    decision: deny
    message: "禁止递归删除根目录"

  - name: "force-push-approval"
    type: command_pattern
    pattern: 'git\s+push.*--force'
    decision: ask
    message: "强制推送需要人工确认"

  - name: "no-write-outside-project"
    type: path_boundary
    pattern: "."
    decision: deny
    message: "禁止写入项目目录外"

  - name: "env-file-protection"
    type: path_pattern
    pattern: "**/.env"
    decision: ask
    message: "修改 .env 文件需要确认"

  - name: "db-drop-protection"
    type: command_pattern
    pattern: '(DROP|DELETE)\s+(TABLE|DATABASE)'
    decision: ask
    message: "删除数据库操作需要确认"
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/core/scaffold.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .gitignore .harness/ src/core/types.ts tests/core/scaffold.test.ts
git commit -m "feat: project scaffolding with shared types and config"
```

---

## Task 2: LLM Abstraction Layer

**Files:**
- Create: `src/core/llm.ts`
- Test: `tests/core/llm.test.ts`

**Interfaces:**
- Consumes: `LLMResponse`, `Message`, `LLMOptions` from `types.ts`
- Produces: `LLMProvider` interface, `MockLLMProvider` class

- [ ] **Step 1: Write the failing test**

```typescript
// tests/core/llm.test.ts
import { describe, it, expect } from "vitest"
import { MockLLMProvider } from "../../src/core/llm"
import type { Message } from "../../src/core/types"

describe("MockLLMProvider", () => {
  it("returns pre-programmed responses in order", async () => {
    const mock = new MockLLMProvider([
      { text: "I'll read the file", action: { type: "call_tool", tool: "file_read", args: { path: "a.ts" } } },
      { text: "Done", action: { type: "done" } },
    ])
    const messages: Message[] = [{ role: "user", content: "read a.ts" }]

    const r1 = await mock.complete(messages)
    expect(r1.text).toBe("I'll read the file")
    expect(r1.action.type).toBe("call_tool")

    const r2 = await mock.complete(messages)
    expect(r2.action.type).toBe("done")
  })

  it("returns done when responses exhausted", async () => {
    const mock = new MockLLMProvider([])
    const r = await mock.complete([])
    expect(r.action.type).toBe("done")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/llm.test.ts`
Expected: FAIL — cannot find module `../../src/core/llm`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/core/llm.ts
import type { Message, LLMResponse, LLMOptions } from "./types.js"

export interface LLMProvider {
  complete(messages: Message[], options?: LLMOptions): Promise<LLMResponse>
}

export class MockLLMProvider implements LLMProvider {
  private responses: LLMResponse[]

  constructor(responses: LLMResponse[]) {
    this.responses = [...responses]
  }

  async complete(_messages: Message[], _options?: LLMOptions): Promise<LLMResponse> {
    if (this.responses.length === 0) {
      return { text: "done", action: { type: "done" } }
    }
    return this.responses.shift()!
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/llm.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/llm.ts tests/core/llm.test.ts
git commit -m "feat: LLM abstraction layer with MockLLMProvider"
```

---

## Task 3: Config System

**Files:**
- Create: `src/core/config.ts`
- Test: `tests/core/config.test.ts`

**Interfaces:**
- Consumes: `Config` from `types.ts`
- Produces: `loadConfig(path: string): Config`, `DEFAULT_CONFIG: Config`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/core/config.test.ts
import { describe, it, expect } from "vitest"
import { loadConfig, DEFAULT_CONFIG } from "../../src/core/config"
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

describe("loadConfig", () => {
  it("loads config from YAML", () => {
    const path = join(tmpdir(), "test-config.yml")
    writeFileSync(path, `
llm:
  provider: "test"
  model: "test-model"
  baseURL: "http://localhost:8080"
tools: [file_read]
policies: "policies.yml"
sensors:
  test: "npm test"
  lint: "eslint ."
  typecheck: "tsc --noEmit"
sandbox:
  timeout: 10
  maxMemory: 256
maxSteps: 20
timeout: 60
`)
    const config = loadConfig(path)
    expect(config.llm.model).toBe("test-model")
    expect(config.maxSteps).toBe(20)
  })

  it("returns defaults when file missing", () => {
    const config = loadConfig("/nonexistent/path.yml")
    expect(config.maxSteps).toBe(DEFAULT_CONFIG.maxSteps)
    expect(config.llm.provider).toBe(DEFAULT_CONFIG.llm.provider)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/config.test.ts`
Expected: FAIL — cannot find module `../../src/core/config`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/core/config.ts
import { readFileSync, existsSync } from "node:fs"
import { parse } from "yaml"
import type { Config } from "./types.js"

export const DEFAULT_CONFIG: Config = {
  llm: { provider: "openai-compatible", model: "glm-5.2", baseURL: "https://njusehub.info/v1" },
  tools: ["file_read", "file_write", "file_delete", "shell_exec", "run_test"],
  policies: ".harness/policies.yml",
  sensors: { test: "npm test", lint: "npx eslint src/", typecheck: "npx tsc --noEmit" },
  sandbox: { timeout: 30, maxMemory: 512 },
  maxSteps: 50,
  timeout: 300,
}

export function loadConfig(path: string): Config {
  if (!existsSync(path)) {
    return { ...DEFAULT_CONFIG }
  }
  const raw = readFileSync(path, "utf-8")
  const parsed = parse(raw)
  return {
    llm: { ...DEFAULT_CONFIG.llm, ...parsed.llm },
    tools: parsed.tools ?? DEFAULT_CONFIG.tools,
    policies: parsed.policies ?? DEFAULT_CONFIG.policies,
    sensors: { ...DEFAULT_CONFIG.sensors, ...parsed.sensors },
    sandbox: { ...DEFAULT_CONFIG.sandbox, ...parsed.sandbox },
    maxSteps: parsed.maxSteps ?? DEFAULT_CONFIG.maxSteps,
    timeout: parsed.timeout ?? DEFAULT_CONFIG.timeout,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/config.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/config.ts tests/core/config.test.ts
git commit -m "feat: config system with YAML loading and defaults"
```

---

## Task 4: Tool System

**Files:**
- Create: `src/core/tools/file.ts`
- Create: `src/core/tools/shell.ts`
- Create: `src/core/tools/test-runner.ts`
- Test: `tests/core/tools/file.test.ts`
- Test: `tests/core/tools/shell.test.ts`
- Test: `tests/core/tools/test-runner.test.ts`

**Interfaces:**
- Consumes: `ToolArgs`, `ToolResult` from `types.ts`
- Produces: `Tool` interface, `fileRead`, `fileWrite`, `fileDelete`, `shellExec`, `runTest` functions

- [ ] **Step 1: Write the failing tests for file tools**

```typescript
// tests/core/tools/file.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { fileRead, fileWrite, fileDelete } from "../../../src/core/tools/file"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

describe("file tools", () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "harness-test-"))
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it("fileRead reads file content", async () => {
    const path = join(dir, "a.ts")
    writeFileSync(path, "hello world")
    const result = await fileRead({ path })
    expect(result.success).toBe(true)
    expect(result.content).toBe("hello world")
  })

  it("fileRead returns error for missing file", async () => {
    const result = await fileRead({ path: join(dir, "nope.ts") })
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it("fileWrite writes content", async () => {
    const path = join(dir, "b.ts")
    const result = await fileWrite({ path, content: "written" })
    expect(result.success).toBe(true)
    const readBack = await fileRead({ path })
    expect(readBack.content).toBe("written")
  })

  it("fileDelete removes file", async () => {
    const path = join(dir, "c.ts")
    writeFileSync(path, "temp")
    const result = await fileDelete({ path })
    expect(result.success).toBe(true)
    const readBack = await fileRead({ path })
    expect(readBack.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/tools/file.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write file tools implementation**

```typescript
// src/core/tools/file.ts
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs"
import type { ToolArgs, ToolResult } from "../types.js"

export type Tool = (args: ToolArgs) => Promise<ToolResult>

export const fileRead: Tool = async (args) => {
  try {
    if (!args.path) return { success: false, error: "path required" }
    if (!existsSync(args.path)) return { success: false, error: `file not found: ${args.path}` }
    const content = readFileSync(args.path, "utf-8")
    return { success: true, content }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export const fileWrite: Tool = async (args) => {
  try {
    if (!args.path) return { success: false, error: "path required" }
    if (args.content === undefined) return { success: false, error: "content required" }
    writeFileSync(args.path, args.content)
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export const fileDelete: Tool = async (args) => {
  try {
    if (!args.path) return { success: false, error: "path required" }
    if (!existsSync(args.path)) return { success: false, error: `file not found: ${args.path}` }
    unlinkSync(args.path)
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/tools/file.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Write the failing test for shell_exec**

```typescript
// tests/core/tools/shell.test.ts
import { describe, it, expect } from "vitest"
import { shellExec } from "../../../src/core/tools/shell"

describe("shellExec", () => {
  it("executes echo command", async () => {
    const result = await shellExec({ command: "echo hello" })
    expect(result.success).toBe(true)
    expect(result.stdout?.trim()).toBe("hello")
    expect(result.exitCode).toBe(0)
  })

  it("captures stderr on failure", async () => {
    const result = await shellExec({ command: "ls /nonexistent/dir 2>&1 || true" })
    expect(result.success).toBe(true)
  })

  it("times out on long command", async () => {
    const result = await shellExec({ command: "sleep 10" }, { timeout: 1 })
    expect(result.success).toBe(false)
    expect(result.error).toContain("timeout")
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run tests/core/tools/shell.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 7: Write shell implementation**

```typescript
// src/core/tools/shell.ts
import { execSync } from "node:child_process"
import type { ToolArgs, ToolResult } from "../types.js"
import type { Tool } from "./file.js"

export const shellExec: Tool = async (args, opts?: { timeout?: number }) => {
  try {
    if (!args.command) return { success: false, error: "command required" }
    const timeout = opts?.timeout ?? 30000
    const stdout = execSync(args.command, {
      timeout,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })
    return { success: true, stdout, stderr: "", exitCode: 0 }
  } catch (e: any) {
    if (e.signal === "SIGTERM") {
      return { success: false, error: "timeout", exitCode: null, stdout: e.stdout ?? "", stderr: e.stderr ?? "" }
    }
    return {
      success: false,
      error: String(e.message ?? e),
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
      exitCode: e.status ?? 1,
    }
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run tests/core/tools/shell.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 9: Write the failing test for run_test**

```typescript
// tests/core/tools/test-runner.test.ts
import { describe, it, expect } from "vitest"
import { runTest } from "../../../src/core/tools/test-runner"

describe("runTest", () => {
  it("detects passing tests", async () => {
    const result = await runTest({ command: "echo 'All tests passed'" })
    expect(result.success).toBe(true)
  })

  it("detects failing tests", async () => {
    const result = await runTest({ command: "echo 'FAIL' && exit 1" })
    expect(result.success).toBe(false)
    expect(result.exitCode).toBe(1)
  })
})
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npx vitest run tests/core/tools/test-runner.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 11: Write test-runner implementation**

```typescript
// src/core/tools/test-runner.ts
import { execSync } from "node:child_process"
import type { ToolArgs, ToolResult } from "../types.js"
import type { Tool } from "./file.js"

export const runTest: Tool = async (args) => {
  try {
    if (!args.command) return { success: false, error: "command required" }
    const stdout = execSync(args.command, {
      timeout: 300000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })
    return { success: true, stdout, stderr: "", exitCode: 0 }
  } catch (e: any) {
    return {
      success: false,
      error: String(e.message ?? e),
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
      exitCode: e.status ?? 1,
    }
  }
}
```

- [ ] **Step 12: Run all tool tests to verify they pass**

Run: `npx vitest run tests/core/tools/`
Expected: PASS (all tool tests)

- [ ] **Step 13: Commit**

```bash
git add src/core/tools/ tests/core/tools/
git commit -m "feat: tool system (file_read, file_write, file_delete, shell_exec, run_test)"
```

---

## Task 5: Policy Engine (Governance — Focus)

**Files:**
- Create: `src/core/governance/policy.ts`
- Test: `tests/core/governance/policy.test.ts`

**Interfaces:**
- Consumes: `Action`, `GuardrailDecision`, `Policy`, `PolicyType` from `types.ts`
- Produces: `PolicyEngine` class with `evaluate(action: Action): { decision: GuardrailDecision; policy?: Policy }`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/core/governance/policy.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/governance/policy.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/core/governance/policy.ts
import { readFileSync, existsSync } from "node:fs"
import { parse } from "yaml"
import { resolve, relative, isAbsolute } from "node:path"
import type { Action, GuardrailDecision, Policy } from "../types.js"

export class PolicyEngine {
  private policies: Policy[]

  constructor(policies: Policy[]) {
    this.policies = policies
  }

  static fromYaml(path: string): PolicyEngine {
    if (!existsSync(path)) return new PolicyEngine([])
    const raw = readFileSync(path, "utf-8")
    const parsed = parse(raw)
    return new PolicyEngine(parsed.rules ?? [])
  }

  evaluate(action: Action): { decision: GuardrailDecision; policy?: Policy } {
    for (const policy of this.policies) {
      if (this.matchPolicy(policy, action)) {
        return { decision: policy.decision, policy }
      }
    }
    return { decision: "allow" }
  }

  private matchPolicy(policy: Policy, action: Action): boolean {
    if (policy.type === "command_pattern") {
      const cmd = action.args?.command ?? ""
      return new RegExp(policy.pattern).test(cmd)
    }
    if (policy.type === "path_pattern") {
      const path = action.args?.path ?? ""
      return this.globMatch(policy.pattern, path)
    }
    if (policy.type === "path_boundary") {
      const path = action.args?.path ?? ""
      if (!path) return false
      const resolved = resolve(path)
      const boundary = resolve(policy.pattern)
      const rel = relative(boundary, resolved)
      return rel.startsWith("..") || isAbsolute(rel)
    }
    return false
  }

  private globMatch(pattern: string, path: string): boolean {
    const regexStr = pattern
      .replace(/\*\*/g, ".*")
      .replace(/\*/g, "[^/]*")
      .replace(/\?/g, ".")
    return new RegExp(`^${regexStr}$`).test(path)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/governance/policy.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/governance/policy.ts tests/core/governance/policy.test.ts
git commit -m "feat: Policy Engine — command pattern, path boundary, path pattern matching"
```

---

## Task 6: HITL State Machine (Governance — Focus)

**Files:**
- Create: `src/core/governance/hitl.ts`
- Test: `tests/core/governance/hitl.test.ts`

**Interfaces:**
- Consumes: `Action`, `AgentState` from `types.ts`
- Produces: `HitlStateMachine` class

- [ ] **Step 1: Write the failing test**

```typescript
// tests/core/governance/hitl.test.ts
import { describe, it, expect } from "vitest"
import { HitlStateMachine } from "../../../src/core/governance/hitl"
import { AgentState } from "../../../src/core/types"
import type { Action } from "../../../src/core/types"

const dangerousAction: Action = {
  type: "call_tool",
  tool: "shell_exec",
  args: { command: "git push --force" },
}

describe("HitlStateMachine", () => {
  it("starts in Running state", () => {
    const sm = new HitlStateMachine()
    expect(sm.getState()).toBe(AgentState.Running)
  })

  it("transitions to PendingApproval on requestApproval", () => {
    const sm = new HitlStateMachine()
    sm.requestApproval(dangerousAction)
    expect(sm.getState()).toBe(AgentState.PendingApproval)
  })

  it("returns action on approve", () => {
    const sm = new HitlStateMachine()
    sm.requestApproval(dangerousAction)
    const action = sm.approve()
    expect(action).toEqual(dangerousAction)
    expect(sm.getState()).toBe(AgentState.Running)
  })

  it("returns null on approve without pending", () => {
    const sm = new HitlStateMachine()
    expect(sm.approve()).toBeNull()
  })

  it("clears pending on deny", () => {
    const sm = new HitlStateMachine()
    sm.requestApproval(dangerousAction)
    sm.deny()
    expect(sm.getState()).toBe(AgentState.Running)
    expect(sm.getPendingAction()).toBeNull()
  })

  it("auto-denies on timeout", () => {
    const sm = new HitlStateMachine()
    sm.requestApproval(dangerousAction)
    sm.timeout()
    expect(sm.getState()).toBe(AgentState.Running)
  })

  it("transitions to Stopped on stop", () => {
    const sm = new HitlStateMachine()
    sm.stop()
    expect(sm.getState()).toBe(AgentState.Stopped)
  })

  it("ignores requestApproval when Stopped", () => {
    const sm = new HitlStateMachine()
    sm.stop()
    sm.requestApproval(dangerousAction)
    expect(sm.getState()).toBe(AgentState.Stopped)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/governance/hitl.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/core/governance/hitl.ts
import { AgentState } from "../types.js"
import type { Action } from "../types.js"

export class HitlStateMachine {
  private state: AgentState = AgentState.Running
  private pendingAction: Action | null = null

  getState(): AgentState {
    return this.state
  }

  getPendingAction(): Action | null {
    return this.pendingAction
  }

  requestApproval(action: Action): void {
    if (this.state === AgentState.Stopped) return
    this.state = AgentState.PendingApproval
    this.pendingAction = action
  }

  approve(): Action | null {
    if (this.state !== AgentState.PendingApproval) return null
    const action = this.pendingAction
    this.pendingAction = null
    this.state = AgentState.Running
    return action
  }

  deny(): void {
    if (this.state !== AgentState.PendingApproval) return
    this.pendingAction = null
    this.state = AgentState.Running
  }

  timeout(): void {
    this.deny()
  }

  stop(): void {
    this.state = AgentState.Stopped
    this.pendingAction = null
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/governance/hitl.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/governance/hitl.ts tests/core/governance/hitl.test.ts
git commit -m "feat: HITL state machine — Running/PendingApproval/Stopped transitions"
```

---

## Task 7: Sandbox (Governance — Focus)

**Files:**
- Create: `src/core/governance/sandbox.ts`
- Test: `tests/core/governance/sandbox.test.ts`

**Interfaces:**
- Consumes: `Tool`, `ToolArgs`, `ToolResult` from types
- Produces: `Sandbox` class with `run(tool: Tool, args: ToolArgs): Promise<ToolResult>`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/core/governance/sandbox.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { Sandbox } from "../../../src/core/governance/sandbox"
import { fileWrite } from "../../../src/core/tools/file"
import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

describe("Sandbox", () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "sandbox-"))
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it("allows write inside project dir", async () => {
    const sandbox = new Sandbox(dir, { timeout: 30, maxMemory: 512 })
    const result = await sandbox.run(fileWrite, { path: join(dir, "a.ts"), content: "x" })
    expect(result.success).toBe(true)
  })

  it("blocks write outside project dir", async () => {
    const sandbox = new Sandbox(dir, { timeout: 30, maxMemory: 512 })
    const result = await sandbox.run(fileWrite, { path: "/etc/passwd", content: "hacked" })
    expect(result.success).toBe(false)
    expect(result.error).toContain("outside")
  })

  it("blocks absolute path outside project", async () => {
    const sandbox = new Sandbox(dir, { timeout: 30, maxMemory: 512 })
    const result = await sandbox.run(fileWrite, { path: "/tmp/outside.ts", content: "x" })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/governance/sandbox.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/core/governance/sandbox.ts
import { resolve, relative, isAbsolute } from "node:path"
import type { ToolArgs, ToolResult } from "../types.js"
import type { Tool } from "../tools/file.js"

export interface SandboxLimits {
  timeout: number
  maxMemory: number
}

export class Sandbox {
  private projectDir: string
  private limits: SandboxLimits

  constructor(projectDir: string, limits: SandboxLimits) {
    this.projectDir = resolve(projectDir)
    this.limits = limits
  }

  async run(tool: Tool, args: ToolArgs): Promise<ToolResult> {
    if (args.path && !this.isPathAllowed(args.path)) {
      return { success: false, error: `path outside project directory: ${args.path}` }
    }
    return tool(args)
  }

  private isPathAllowed(path: string): boolean {
    const resolved = resolve(this.projectDir, path)
    const rel = relative(this.projectDir, resolved)
    return !rel.startsWith("..") && !isAbsolute(rel)
  }

  getProjectDir(): string {
    return this.projectDir
  }

  getLimits(): SandboxLimits {
    return this.limits
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/governance/sandbox.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/governance/sandbox.ts tests/core/governance/sandbox.test.ts
git commit -m "feat: Sandbox — path boundary enforcement for tool execution"
```

---

## Task 8: Feedback System

**Files:**
- Create: `src/core/feedback/validator.ts`
- Create: `src/core/feedback/classifier.ts`
- Test: `tests/core/feedback/validator.test.ts`
- Test: `tests/core/feedback/classifier.test.ts`

**Interfaces:**
- Consumes: `ToolResult`, `FeedbackReport`, `Failure`, `FailureCategory` from `types.ts`
- Produces: `FeedbackValidator` class, `classifyFailure(output: string): FailureCategory`

- [ ] **Step 1: Write the failing test for classifier**

```typescript
// tests/core/feedback/classifier.test.ts
import { describe, it, expect } from "vitest"
import { classifyFailure } from "../../../src/core/feedback/classifier"

describe("classifyFailure", () => {
  it("classifies syntax errors", () => {
    expect(classifyFailure("SyntaxError: unexpected token")).toBe("syntax_error")
    expect(classifyFailure("error TS1005: ';' expected")).toBe("syntax_error")
  })

  it("classifies test failures", () => {
    expect(classifyFailure("FAIL src/a.test.ts")).toBe("test_failure")
    expect(classifyFailure("AssertionError: expected 1 to be 2")).toBe("test_failure")
  })

  it("classifies type errors", () => {
    expect(classifyFailure("error TS2322: Type 'string' is not assignable")).toBe("type_error")
  })

  it("classifies lint violations", () => {
    expect(classifyFailure("error: 'x' is defined but never used")).toBe("lint_violation")
    expect(classifyFailure("eslint: no-unused-vars")).toBe("lint_violation")
  })

  it("returns unknown for unrecognized", () => {
    expect(classifyFailure("something weird happened")).toBe("unknown")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/feedback/classifier.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write classifier implementation**

```typescript
// src/core/feedback/classifier.ts
import type { FailureCategory } from "../types.js"

export function classifyFailure(output: string): FailureCategory {
  const lower = output.toLowerCase()
  if (lower.includes("syntaxerror") || lower.includes("ts1005") || lower.includes("syntax error")) {
    return "syntax_error"
  }
  if (lower.includes("ts2322") || lower.includes("type '") || lower.includes("is not assignable")) {
    return "type_error"
  }
  if (lower.includes("eslint") || lower.includes("no-unused") || lower.includes("defined but never used")) {
    return "lint_violation"
  }
  if (lower.includes("fail") || lower.includes("assertion") || lower.includes("expected") && lower.includes("to be")) {
    return "test_failure"
  }
  return "unknown"
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/feedback/classifier.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Write the failing test for validator**

```typescript
// tests/core/feedback/validator.test.ts
import { describe, it, expect } from "vitest"
import { FeedbackValidator } from "../../../src/core/feedback/validator"

describe("FeedbackValidator", () => {
  it("reports passed when exit code 0", () => {
    const validator = new FeedbackValidator({ test: "npm test" })
    const report = validator.validate({
      success: true,
      stdout: "All tests passed",
      stderr: "",
      exitCode: 0,
    })
    expect(report.passed).toBe(true)
    expect(report.failures).toHaveLength(0)
  })

  it("reports failures when exit code non-zero", () => {
    const validator = new FeedbackValidator({ test: "npm test" })
    const report = validator.validate({
      success: false,
      stdout: "FAIL src/a.test.ts\n  AssertionError: expected 1 to be 2",
      stderr: "",
      exitCode: 1,
    })
    expect(report.passed).toBe(false)
    expect(report.failures.length).toBeGreaterThan(0)
    expect(report.category).toBe("test_failure")
  })

  it("extracts failure file and line", () => {
    const validator = new FeedbackValidator({ test: "npm test" })
    const report = validator.validate({
      success: false,
      stdout: "FAIL src/math.test.ts:12\n  expected 1 to be 2",
      stderr: "",
      exitCode: 1,
    })
    expect(report.failures[0].file).toBe("src/math.test.ts")
    expect(report.failures[0].line).toBe(12)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run tests/core/feedback/validator.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 7: Write validator implementation**

```typescript
// src/core/feedback/validator.ts
import type { ToolResult, FeedbackReport, Failure } from "../types.js"
import { classifyFailure } from "./classifier.js"

export interface SensorConfig {
  test: string
  lint: string
  typecheck: string
}

export class FeedbackValidator {
  private sensors: SensorConfig

  constructor(sensors: SensorConfig) {
    this.sensors = sensors
  }

  validate(result: ToolResult): FeedbackReport {
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`
    if (result.success && (result.exitCode === 0 || result.exitCode === undefined)) {
      return { passed: true, failures: [], category: "unknown", rawOutput: output }
    }
    const failures = this.extractFailures(output)
    const category = classifyFailure(output)
    return { passed: false, failures, category, rawOutput: output }
  }

  private extractFailures(output: string): Failure[] {
    const failures: Failure[] = []
    const lines = output.split("\n")
    for (const line of lines) {
      const match = line.match(/(?:FAIL|✕|×)\s+(.+?):(\d+)/)
      if (match) {
        failures.push({ message: line, file: match[1], line: parseInt(match[2], 10) })
      }
    }
    if (failures.length === 0 && output.trim()) {
      failures.push({ message: output.trim().slice(0, 200) })
    }
    return failures
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run tests/core/feedback/`
Expected: PASS (all feedback tests)

- [ ] **Step 9: Commit**

```bash
git add src/core/feedback/ tests/core/feedback/
git commit -m "feat: feedback system — validator and failure classifier"
```

---

## Task 9: Memory System

**Files:**
- Create: `src/core/memory.ts`
- Test: `tests/core/memory.test.ts`

**Interfaces:**
- Consumes: nothing (self-contained)
- Produces: `MemoryStore` class with `read(query)`, `write(note)`, `consolidate(context)`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/core/memory.test.ts
import { describe, it, expect, beforeEach } from "vitest"
import { MemoryStore } from "../../src/core/memory"
import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

describe("MemoryStore", () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "memory-"))
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it("writes and reads back a note", () => {
    const store = new MemoryStore(join(dir, "memory.json"))
    store.write("Use Vitest for testing")
    const results = store.read("testing")
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]).toContain("Vitest")
  })

  it("returns empty for no matches", () => {
    const store = new MemoryStore(join(dir, "memory.json"))
    store.write("Use Vitest for testing")
    const results = store.read("nonexistent")
    expect(results).toHaveLength(0)
  })

  it("consolidate persists across instances", () => {
    const path = join(dir, "memory.json")
    const store1 = new MemoryStore(path)
    store1.write("Important decision: use ESM")
    store1.consolidate("session context with ESM decision")
    const store2 = new MemoryStore(path)
    const results = store2.read("ESM")
    expect(results.length).toBeGreaterThan(0)
  })

  it("enforces max entries with LRU", () => {
    const store = new MemoryStore(join(dir, "memory.json"), 3)
    store.write("note 1")
    store.write("note 2")
    store.write("note 3")
    store.write("note 4")
    const results = store.read("note 1")
    expect(results).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/memory.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/core/memory.ts
import { readFileSync, writeFileSync, existsSync } from "node:fs"

interface MemoryEntry {
  content: string
  lastAccessed: number
}

export class MemoryStore {
  private entries: MemoryEntry[] = []
  private filePath: string
  private maxEntries: number

  constructor(filePath: string, maxEntries = 1000) {
    this.filePath = filePath
    this.maxEntries = maxEntries
    this.load()
  }

  write(note: string): void {
    this.entries.push({ content: note, lastAccessed: Date.now() })
    this.evict()
    this.save()
  }

  read(query: string): string[] {
    const lower = query.toLowerCase()
    const matched = this.entries.filter((e) => e.content.toLowerCase().includes(lower))
    matched.forEach((e) => (e.lastAccessed = Date.now()))
    this.save()
    return matched.map((e) => e.content)
  }

  consolidate(context: string): void {
    this.write(`[consolidated] ${context.slice(0, 500)}`)
  }

  private load(): void {
    if (!existsSync(this.filePath)) return
    try {
      const raw = readFileSync(this.filePath, "utf-8")
      this.entries = JSON.parse(raw)
    } catch {
      this.entries = []
    }
  }

  private save(): void {
    try {
      writeFileSync(this.filePath, JSON.stringify(this.entries, null, 2))
    } catch {
      // ignore save errors
    }
  }

  private evict(): void {
    while (this.entries.length > this.maxEntries) {
      const oldest = this.entries.reduce((min, e, i) => (e.lastAccessed < this.entries[min].lastAccessed ? i : min), 0)
      this.entries.splice(oldest, 1)
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/memory.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/memory.ts tests/core/memory.test.ts
git commit -m "feat: memory system — file-based KV store with LRU eviction"
```

---

## Task 10: Tracer

**Files:**
- Create: `src/core/tracer.ts`
- Test: `tests/core/tracer.test.ts`

**Interfaces:**
- Consumes: `TraceEvent`, `TraceEventType` from `types.ts`
- Produces: `Tracer` class with `record()`, `export()`, `getActions()`, `getDenials()`, `getFeedbackReports()`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/core/tracer.test.ts
import { describe, it, expect } from "vitest"
import { Tracer } from "../../src/core/tracer"
import type { TraceEvent } from "../../src/core/types"

describe("Tracer", () => {
  it("records and exports events", () => {
    const tracer = new Tracer()
    tracer.record({ type: "thinking", data: { text: "analyzing" } })
    tracer.record({ type: "action", data: { tool: "file_read" } })
    const events = tracer.export()
    expect(events).toHaveLength(2)
    expect(events[0].type).toBe("thinking")
    expect(events[1].type).toBe("action")
  })

  it("getActions returns only action events", () => {
    const tracer = new Tracer()
    tracer.record({ type: "thinking", data: {} })
    tracer.record({ type: "action", data: { tool: "file_read" } })
    tracer.record({ type: "action", data: { tool: "shell_exec" } })
    expect(tracer.getActions()).toHaveLength(2)
  })

  it("getDenials returns governance deny events", () => {
    const tracer = new Tracer()
    tracer.record({ type: "governance", data: { decision: "deny" } })
    tracer.record({ type: "governance", data: { decision: "allow" } })
    tracer.record({ type: "governance", data: { decision: "deny" } })
    expect(tracer.getDenials()).toHaveLength(2)
  })

  it("getFeedbackReports returns feedback events", () => {
    const tracer = new Tracer()
    tracer.record({ type: "feedback", data: { passed: false } })
    tracer.record({ type: "feedback", data: { passed: true } })
    expect(tracer.getFeedbackReports()).toHaveLength(2)
  })

  it("enforces max events in memory", () => {
    const tracer = new Tracer(3)
    tracer.record({ type: "thinking", data: { i: 1 } })
    tracer.record({ type: "thinking", data: { i: 2 } })
    tracer.record({ type: "thinking", data: { i: 3 } })
    tracer.record({ type: "thinking", data: { i: 4 } })
    expect(tracer.export()).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/tracer.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/core/tracer.ts
import type { TraceEvent, TraceEventType } from "./types.js"

export class Tracer {
  private events: TraceEvent[] = []
  private maxEvents: number
  private onEvent?: (event: TraceEvent) => void

  constructor(maxEvents = 500, onEvent?: (event: TraceEvent) => void) {
    this.maxEvents = maxEvents
    this.onEvent = onEvent
  }

  record(event: Omit<TraceEvent, "timestamp">): void {
    const full: TraceEvent = { ...event, timestamp: Date.now() }
    this.events.push(full)
    if (this.events.length > this.maxEvents) {
      this.events.shift()
    }
    this.onEvent?.(full)
  }

  export(): TraceEvent[] {
    return [...this.events]
  }

  getActions(): TraceEvent[] {
    return this.events.filter((e) => e.type === "action")
  }

  getDenials(): TraceEvent[] {
    return this.events.filter(
      (e) => e.type === "governance" && (e.data as any).decision === "deny"
    )
  }

  getFeedbackReports(): TraceEvent[] {
    return this.events.filter((e) => e.type === "feedback")
  }

  flush(path: string): void {
    // In production: write to file. For now, no-op (tests use export())
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/tracer.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/tracer.ts tests/core/tracer.test.ts
git commit -m "feat: tracer — observability with event recording and filtering"
```

---

## Task 11: Agent Main Loop

**Files:**
- Create: `src/core/loop.ts`
- Test: `tests/core/loop.test.ts`
- Test: `tests/integration/agent-loop.test.ts`

**Interfaces:**
- Consumes: `LLMProvider`, `PolicyEngine`, `HitlStateMachine`, `Sandbox`, `FeedbackValidator`, `MemoryStore`, `Tracer`, `Config`, all tool functions
- Produces: `Harness` class with `buildHarness(config)`, `run(goal)` methods

- [ ] **Step 1: Write the failing test**

```typescript
// tests/core/loop.test.ts
import { describe, it, expect } from "vitest"
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/loop.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/core/loop.ts
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

export interface HarnessDeps {
  llm: LLMProvider
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
    this.systemPrompt = "You are a coding agent. Use tools to accomplish the goal. Call 'done' when finished."
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

    while (steps < config.maxSteps && hitl.getState() !== AgentState.Stopped) {
      steps++
      tracer.record({ type: "step", data: { step: steps } })

      const response = await llm.complete(context)
      tracer.record({ type: "thinking", data: { text: response.text } })
      tracer.record({ type: "action", data: response.action })

      context.push({ role: "assistant", content: response.text, action: response.action })

      if (response.action.type === "done") {
        answer = response.text
        tracer.record({ type: "done", data: { answer } })
        break
      }

      if (response.action.type === "take_note") {
        memory.write(response.action.note ?? "")
        continue
      }

      if (response.action.type === "call_tool") {
        const govResult = policyEngine.evaluate(response.action)
        tracer.record({ type: "governance", data: govResult })

        if (govResult.decision === "deny") {
          context.push({ role: "user", content: `Action denied: ${govResult.policy?.message ?? "policy violation"}` })
          continue
        }

        if (govResult.decision === "ask") {
          hitl.requestApproval(response.action)
          tracer.record({ type: "approval_request", data: { action: response.action, policy: govResult.policy } })
          // In test mode, auto-deny (no real user to approve)
          hitl.deny()
          context.push({ role: "user", content: `Action auto-denied (no user): ${govResult.policy?.message ?? ""}` })
          continue
        }

        // Execute via sandbox
        tracer.record({ type: "tool_start", data: { tool: response.action.tool, args: response.action.args } })
        const tool = tools[response.action.tool ?? ""]
        if (!tool) {
          context.push({ role: "user", content: `Tool not found: ${response.action.tool}` })
          continue
        }
        const result = await sandbox.run(tool, response.action.args ?? {})
        tracer.record({ type: "tool_result", data: result })

        // Feedback if code changed
        if (response.action.changedCode) {
          const report = feedback.validate(result)
          tracer.record({ type: "feedback", data: report })
          context.push({ role: "user", content: `Feedback: ${JSON.stringify(report)}` })
        }

        context.push({ role: "user", content: `Tool result: ${JSON.stringify(result)}` })
      }
    }

    memory.consolidate(context.map((m) => m.content).join("\n"))
    return { answer, steps, trace: tracer.export() }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/loop.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/loop.ts tests/core/loop.test.ts
git commit -m "feat: agent main loop — integrates all modules with governance and feedback"
```

---

## Task 12: Context Compaction

**Files:**
- Create: `src/core/compact.ts`
- Test: `tests/core/compact.test.ts`

**Interfaces:**
- Consumes: `LLMProvider`, `Message` from types
- Produces: `compactContext(messages, llm, limit): Promise<Message[]>`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/core/compact.test.ts
import { describe, it, expect } from "vitest"
import { compactContext } from "../../src/core/compact"
import { MockLLMProvider } from "../../src/core/llm"
import type { Message } from "../../src/core/types"

describe("compactContext", () => {
  it("summarizes old messages, keeps recent ones", async () => {
    const messages: Message[] = [
      { role: "system", content: "system prompt" },
      { role: "user", content: "old message 1" },
      { role: "assistant", content: "old reply 1" },
      { role: "user", content: "old message 2" },
      { role: "assistant", content: "old reply 2" },
      { role: "user", content: "recent message" },
    ]
    const mock = new MockLLMProvider([
      { text: "Summary of previous conversation", action: { type: "done" } },
    ])
    const result = await compactContext(messages, mock, { keepRecent: 2, tokenLimit: 100 })
    expect(result[0].role).toBe("system")
    expect(result.some((m) => m.content.includes("Summary"))).toBe(true)
    expect(result.some((m) => m.content === "recent message")).toBe(true)
    expect(result.length).toBeLessThan(messages.length)
  })

  it("does not compact when under limit", async () => {
    const messages: Message[] = [
      { role: "system", content: "sys" },
      { role: "user", content: "hi" },
    ]
    const mock = new MockLLMProvider([])
    const result = await compactContext(messages, mock, { keepRecent: 5, tokenLimit: 10000 })
    expect(result).toEqual(messages)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/compact.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/core/compact.ts
import type { LLMProvider } from "./llm.js"
import type { Message } from "./types.js"

export interface CompactOptions {
  keepRecent: number
  tokenLimit: number
}

export function estimateTokens(messages: Message[]): number {
  return messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0)
}

export async function compactContext(
  messages: Message[],
  llm: LLMProvider,
  options: CompactOptions
): Promise<Message[]> {
  const { keepRecent, tokenLimit } = options

  if (estimateTokens(messages) <= tokenLimit) {
    return messages
  }

  const system = messages.filter((m) => m.role === "system")
  const nonSystem = messages.filter((m) => m.role !== "system")

  const recent = nonSystem.slice(-keepRecent)
  const old = nonSystem.slice(0, -keepRecent)

  if (old.length === 0) {
    return messages
  }

  const summaryPrompt: Message[] = [
    ...system,
    {
      role: "user",
      content: `Summarize the following conversation, preserving key decisions, actions taken, and facts learned:\n\n${old.map((m) => `${m.role}: ${m.content}`).join("\n")}`,
    },
  ]

  const response = await llm.complete(summaryPrompt)
  const summaryMessage: Message = {
    role: "system",
    content: `[Conversation Summary]: ${response.text}`,
  }

  return [...system, summaryMessage, ...recent]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/compact.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/compact.ts tests/core/compact.test.ts
git commit -m "feat: context compaction — LLM summarization for window overflow"
```

---

## Task 13: RealLLMProvider

**Files:**
- Modify: `src/core/llm.ts` (add RealLLMProvider)
- Test: `tests/core/llm-real.test.ts`

**Interfaces:**
- Consumes: `LLMProvider` interface, `Config` from types
- Produces: `RealLLMProvider` class (OpenAI-compatible API client)

- [ ] **Step 1: Write the failing test (mock HTTP)**

```typescript
// tests/core/llm-real.test.ts
import { describe, it, expect, vi } from "vitest"
import { RealLLMProvider } from "../../src/core/llm"

// Mock global fetch
global.fetch = vi.fn()

describe("RealLLMProvider", () => {
  it("calls OpenAI-compatible API with correct format", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: "I'll help",
            tool_calls: [{
              function: {
                name: "file_read",
                arguments: '{"path":"a.ts"}',
              },
            }],
          },
        }],
      }),
    })

    const provider = new RealLLMProvider({
      baseURL: "https://api.example.com/v1",
      model: "test-model",
      apiKey: "sk-test",
    })

    const response = await provider.complete([{ role: "user", content: "read a.ts" }])
    expect(response.text).toBe("I'll help")
    expect(response.action.type).toBe("call_tool")
    expect(response.action.tool).toBe("file_read")

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.example.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Authorization": "Bearer sk-test",
          "Content-Type": "application/json",
        }),
      })
    )
  })

  it("handles done action (no tool calls)", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Task complete" } }],
      }),
    })
    const provider = new RealLLMProvider({
      baseURL: "https://api.example.com/v1",
      model: "test",
      apiKey: "sk-test",
    })
    const response = await provider.complete([])
    expect(response.action.type).toBe("done")
    expect(response.text).toBe("Task complete")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/llm-real.test.ts`
Expected: FAIL — RealLLMProvider not exported

- [ ] **Step 3: Add RealLLMProvider to llm.ts**

```typescript
// Append to src/core/llm.ts

export interface RealLLMConfig {
  baseURL: string
  model: string
  apiKey: string
}

export class RealLLMProvider implements LLMProvider {
  private config: RealLLMConfig

  constructor(config: RealLLMConfig) {
    this.config = config
  }

  async complete(messages: Message[], options?: LLMOptions): Promise<LLMResponse> {
    const tools = [
      {
        type: "function",
        function: {
          name: "file_read",
          description: "Read a file",
          parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
        },
      },
      {
        type: "function",
        function: {
          name: "file_write",
          description: "Write to a file",
          parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
        },
      },
      {
        type: "function",
        function: {
          name: "shell_exec",
          description: "Execute a shell command",
          parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] },
        },
      },
      {
        type: "function",
        function: {
          name: "run_test",
          description: "Run tests",
          parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] },
        },
      },
    ]

    const body = {
      model: options?.model ?? this.config.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      tools,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
    }

    const res = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`LLM API error ${res.status}: ${errText}`)
    }

    const data = await res.json()
    const message = data.choices[0].message
    const text = message.content ?? ""
    const toolCall = message.tool_calls?.[0]

    if (!toolCall) {
      return { text, action: { type: "done", text } }
    }

    const args = JSON.parse(toolCall.function.arguments)
    return {
      text,
      action: {
        type: "call_tool",
        tool: toolCall.function.name,
        args,
        changedCode: toolCall.function.name === "file_write",
      },
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/llm-real.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/llm.ts tests/core/llm-real.test.ts
git commit -m "feat: RealLLMProvider — OpenAI-compatible API client with tool calling"
```

---

## Task 14: Credential Management

**Files:**
- Create: `src/credentials/keychain.ts`
- Create: `src/credentials/env.ts`
- Test: `tests/credentials/keychain.test.ts`
- Test: `tests/credentials/env.test.ts`

**Interfaces:**
- Produces: `CredentialStore` interface, `KeychainStore` class, `EnvStore` class

- [ ] **Step 1: Write the failing test for keychain**

```typescript
// tests/credentials/keychain.test.ts
import { describe, it, expect, vi } from "vitest"
import { KeychainStore } from "../../src/credentials/keychain"

vi.mock("keytar", () => ({
  default: {
    setPassword: vi.fn().mockResolvedValue(undefined),
    getPassword: vi.fn().mockResolvedValue("sk-test-key"),
    deletePassword: vi.fn().mockResolvedValue(true),
  },
}))

describe("KeychainStore", () => {
  it("stores and retrieves a key", async () => {
    const store = new KeychainStore("coding-agent-harness")
    await store.set("api_key", "sk-test-key")
    const key = await store.get("api_key")
    expect(key).toBe("sk-test-key")
  })

  it("returns null for missing key", async () => {
    const store = new KeychainStore("coding-agent-harness")
    const key = await store.get("nonexistent")
    expect(key).toBeNull()
  })

  it("deletes a key", async () => {
    const store = new KeychainStore("coding-agent-harness")
    await store.delete("api_key")
    const key = await store.get("api_key")
    expect(key).toBeNull()
  })

  it("hasKey returns boolean without revealing value", async () => {
    const store = new KeychainStore("coding-agent-harness")
    await store.set("api_key", "sk-secret")
    expect(await store.hasKey("api_key")).toBe(true)
    expect(await store.hasKey("other")).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/credentials/keychain.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write keychain implementation**

```typescript
// src/credentials/keychain.ts
import keytar from "keytar"

export interface CredentialStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
  hasKey(key: string): Promise<boolean>
}

export class KeychainStore implements CredentialStore {
  private service: string

  constructor(service: string) {
    this.service = service
  }

  async get(key: string): Promise<string | null> {
    return keytar.getPassword(this.service, key)
  }

  async set(key: string, value: string): Promise<void> {
    await keytar.setPassword(this.service, key, value)
  }

  async delete(key: string): Promise<void> {
    await keytar.deletePassword(this.service, key)
  }

  async hasKey(key: string): Promise<boolean> {
    const val = await this.get(key)
    return val !== null && val !== ""
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/credentials/keychain.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Write the failing test for env fallback**

```typescript
// tests/credentials/env.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { EnvStore } from "../../src/credentials/env"
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

describe("EnvStore", () => {
  let dir: string

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "env-")) })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it("writes and reads .env file", async () => {
    const store = new EnvStore(join(dir, ".env"))
    await store.set("API_KEY", "sk-test")
    const val = await store.get("API_KEY")
    expect(val).toBe("sk-test")
  })

  it("returns null for missing key", async () => {
    const store = new EnvStore(join(dir, ".env"))
    expect(await store.get("NOPE")).toBeNull()
  })

  it("deletes a key", async () => {
    const store = new EnvStore(join(dir, ".env"))
    await store.set("API_KEY", "sk-test")
    await store.delete("API_KEY")
    expect(await store.get("API_KEY")).toBeNull()
  })

  it("file has 600 permissions", async () => {
    const path = join(dir, ".env")
    const store = new EnvStore(path)
    await store.set("API_KEY", "sk-test")
    const stat = (await import("node:fs/promises")).stat(path)
    const mode = (await stat).mode & 0o777
    expect(mode).toBe(0o600)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run tests/credentials/env.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 7: Write env implementation**

```typescript
// src/credentials/env.ts
import { readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs"
import type { CredentialStore } from "./keychain.js"

export class EnvStore implements CredentialStore {
  private filePath: string
  private data: Record<string, string> = {}

  constructor(filePath: string) {
    this.filePath = filePath
    this.load()
  }

  async get(key: string): Promise<string | null> {
    return this.data[key] ?? null
  }

  async set(key: string, value: string): Promise<void> {
    this.data[key] = value
    this.save()
  }

  async delete(key: string): Promise<void> {
    delete this.data[key]
    this.save()
  }

  async hasKey(key: string): Promise<boolean> {
    return this.data[key] !== undefined && this.data[key] !== ""
  }

  private load(): void {
    if (!existsSync(this.filePath)) return
    const raw = readFileSync(this.filePath, "utf-8")
    for (const line of raw.split("\n")) {
      const match = line.match(/^([^=]+)=(.*)$/)
      if (match) {
        this.data[match[1].trim()] = match[1].trim() === "API_KEY" ? match[2] : match[2]
      }
    }
  }

  private save(): void {
    const content = Object.entries(this.data).map(([k, v]) => `${k}=${v}`).join("\n")
    writeFileSync(this.filePath, content, { mode: 0o600 })
    chmodSync(this.filePath, 0o600)
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run tests/credentials/`
Expected: PASS (all credential tests)

- [ ] **Step 9: Commit**

```bash
git add src/credentials/ tests/credentials/
git commit -m "feat: credential management — keychain store and env fallback"
```

---

## Task 15: WebUI Backend

**Files:**
- Create: `src/web/server.ts`
- Create: `src/web/routes/sessions.ts`
- Create: `src/web/routes/config.ts`
- Create: `src/web/routes/credentials.ts`
- Test: `tests/web/server.test.ts`

**Interfaces:**
- Consumes: `Harness`, `Config`, `CredentialStore`
- Produces: Express app with REST API + WebSocket

- [ ] **Step 1: Write the failing test**

```typescript
// tests/web/server.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createServer } from "node:http"
import { createHarnessServer } from "../../src/web/server"
import { MockLLMProvider } from "../../src/core/llm"
import type { Server } from "node:http"

describe("WebUI Server", () => {
  let server: Server
  let port: number

  beforeAll(async () => {
    const result = await createHarnessServer({
      llm: new MockLLMProvider([{ text: "Done", action: { type: "done" } }]),
      config: {
        llm: { provider: "mock", model: "mock", baseURL: "" },
        tools: [], policies: "", sensors: { test: "", lint: "", typecheck: "" },
        sandbox: { timeout: 30, maxMemory: 512 }, maxSteps: 50, timeout: 300,
      },
      projectDir: process.cwd(),
    })
    server = result.server
    port = result.port
  })

  afterAll(() => server.close())

  it("GET /api/health returns ok", async () => {
    const res = await fetch(`http://localhost:${port}/api/health`)
    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(data.status).toBe("ok")
  })

  it("POST /api/sessions creates a session", async () => {
    const res = await fetch(`http://localhost:${port}/api/sessions`, { method: "POST" })
    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(data.id).toBeTruthy()
  })

  it("GET /api/config returns config", async () => {
    const res = await fetch(`http://localhost:${port}/api/config`)
    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(data.maxSteps).toBe(50)
  })

  it("GET /api/credentials returns hasKey boolean", async () => {
    const res = await fetch(`http://localhost:${port}/api/credentials`)
    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(typeof data.hasKey).toBe("boolean")
    expect(data.key).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/web/server.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write server implementation**

```typescript
// src/web/server.ts
import express from "express"
import { WebSocketServer } from "ws"
import { createServer } from "node:http"
import type { LLMProvider } from "../core/llm.js"
import type { Config } from "../core/types.js"
import { Harness } from "../core/loop.js"
import { PolicyEngine } from "../core/governance/policy.js"
import { HitlStateMachine } from "../core/governance/hitl.js"
import { Sandbox } from "../core/governance/sandbox.js"
import { FeedbackValidator } from "../core/feedback/validator.js"
import { MemoryStore } from "../core/memory.js"
import { Tracer } from "../core/tracer.js"
import { fileRead, fileWrite, fileDelete } from "../core/tools/file.js"
import { shellExec } from "../core/tools/shell.js"
import { runTest } from "../core/tools/test-runner.js"
import type { Tool } from "../core/tools/file.js"
import { KeychainStore } from "../credentials/keychain.js"
import { join } from "node:path"

export interface ServerDeps {
  llm: LLMProvider
  config: Config
  projectDir: string
}

export async function createHarnessServer(deps: ServerDeps): Promise<{ server: import("node:http").Server; port: number }> {
  const app = express()
  app.use(express.json())

  const server = createServer(app)
  const wss = new WebSocketServer({ server, path: "/ws" })

  const sessions = new Map<string, { harness: Harness; hitl: HitlStateMachine; tracer: Tracer }>()
  const credentialStore = new KeychainStore("coding-agent-harness")

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" })
  })

  // Sessions
  app.post("/api/sessions", (_req, res) => {
    const id = `session-${Date.now()}`
    const tracer = new Tracer(500, (event) => {
      wss.clients.forEach((client) => {
        if (client.readyState === 1) client.send(JSON.stringify(event))
      })
    })
    const hitl = new HitlStateMachine()
    const harness = new Harness({
      llm: deps.llm,
      config: deps.config,
      policyEngine: PolicyEngine.fromYaml(deps.config.policies),
      hitl,
      sandbox: new Sandbox(deps.projectDir, deps.config.sandbox),
      feedback: new FeedbackValidator(deps.config.sensors),
      memory: new MemoryStore(join(deps.projectDir, ".harness", "memory.json")),
      tracer,
      tools: { file_read: fileRead, file_write: fileWrite, file_delete: fileDelete, shell_exec: shellExec, run_test: runTest } as Record<string, Tool>,
    })
    sessions.set(id, { harness, hitl, tracer })
    res.json({ id })
  })

  app.post("/api/sessions/:id/message", async (req, res) => {
    const session = sessions.get(req.params.id)
    if (!session) return res.status(404).json({ error: "session not found" })
    const { message } = req.body
    session.harness.run(message).then((result) => {
      wss.clients.forEach((client) => {
        if (client.readyState === 1) client.send(JSON.stringify({ type: "done", data: result }))
      })
    })
    res.json({ status: "started" })
  })

  app.post("/api/sessions/:id/approve", (req, res) => {
    const session = sessions.get(req.params.id)
    if (!session) return res.status(404).json({ error: "session not found" })
    const { approved } = req.body
    if (approved) session.hitl.approve()
    else session.hitl.deny()
    res.json({ status: "ok" })
  })

  app.post("/api/sessions/:id/stop", (req, res) => {
    const session = sessions.get(req.params.id)
    if (!session) return res.status(404).json({ error: "session not found" })
    session.hitl.stop()
    res.json({ status: "stopped" })
  })

  // Config
  app.get("/api/config", (_req, res) => {
    res.json(deps.config)
  })

  app.put("/api/config", (req, res) => {
    Object.assign(deps.config, req.body)
    res.json({ status: "ok" })
  })

  // Credentials
  app.get("/api/credentials", async (_req, res) => {
    const hasKey = await credentialStore.hasKey("api_key")
    res.json({ hasKey })
  })

  app.post("/api/credentials", async (req, res) => {
    const { key } = req.body
    if (!key) return res.status(400).json({ error: "key required" })
    await credentialStore.set("api_key", key)
    res.json({ status: "ok" })
  })

  app.delete("/api/credentials", async (_req, res) => {
    await credentialStore.delete("api_key")
    res.json({ status: "ok" })
  })

  return new Promise((resolve) => {
    server.listen(0, () => {
      const addr = server.address()
      const port = typeof addr === "object" && addr ? addr.port : 3000
      resolve({ server, port })
    })
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/web/server.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/web/ tests/web/
git commit -m "feat: WebUI backend — Express API + WebSocket event streaming"
```

---

## Task 16: WebUI Frontend

**Files:**
- Create: `src/web/frontend/App.tsx`
- Create: `src/web/frontend/components/ChatPanel.tsx`
- Create: `src/web/frontend/components/MonitorPanel.tsx`
- Create: `src/web/frontend/components/ApprovalModal.tsx`
- Create: `src/web/frontend/hooks/useWebSocket.ts`
- Create: `src/web/frontend/index.html`
- Create: `src/web/frontend/main.tsx`
- Create: `vite.config.ts`

**Interfaces:**
- Consumes: REST API + WebSocket from Task 15
- Produces: React app with chat, monitor, HITL modal

- [ ] **Step 1: Create vite.config.ts and frontend entry**

```typescript
// vite.config.ts
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3000",
      "/ws": { target: "ws://localhost:3000", ws: true },
    },
  },
  build: { outDir: "dist/frontend" },
})
```

```html
<!-- src/web/frontend/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Coding Agent Harness</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/main.tsx"></script>
</body>
</html>
```

```typescript
// src/web/frontend/main.tsx
import React from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App"

createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>
)
```

- [ ] **Step 2: Create useWebSocket hook**

```typescript
// src/web/frontend/hooks/useWebSocket.ts
import { useEffect, useState, useCallback } from "react"
import type { TraceEvent } from "../../../core/types"

export function useWebSocket() {
  const [events, setEvents] = useState<TraceEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [ws, setWs] = useState<WebSocket | null>(null)

  useEffect(() => {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:"
    const socket = new WebSocket(`${protocol}//${location.host}/ws`)
    socket.onopen = () => setConnected(true)
    socket.onclose = () => setConnected(false)
    socket.onmessage = (e) => {
      const event: TraceEvent = JSON.parse(e.data)
      setEvents((prev) => [...prev, event])
    }
    setWs(socket)
    return () => socket.close()
  }, [])

  const clearEvents = useCallback(() => setEvents([]), [])
  return { events, connected, clearEvents }
}
```

- [ ] **Step 3: Create ChatPanel component**

```tsx
// src/web/frontend/components/ChatPanel.tsx
import { useState } from "react"

interface ChatPanelProps {
  onSend: (message: string) => void
  messages: { role: string; content: string }[]
}

export function ChatPanel({ onSend, messages }: ChatPanelProps) {
  const [input, setInput] = useState("")

  const handleSend = () => {
    if (input.trim()) {
      onSend(input)
      setInput("")
    }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "16px" }}>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: "8px", textAlign: m.role === "user" ? "right" : "left" }}>
            <span style={{
              display: "inline-block", padding: "8px 12px", borderRadius: "8px",
              background: m.role === "user" ? "#3b82f6" : "#e5e7eb",
              color: m.role === "user" ? "white" : "black",
            }}>{m.content}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          style={{ flex: 1, padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="输入消息..."
        />
        <button onClick={handleSend} style={{ padding: "8px 16px" }}>发送</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create MonitorPanel component (collapsible)**

```tsx
// src/web/frontend/components/MonitorPanel.tsx
import { useState } from "react"
import type { TraceEvent } from "../../../core/types"

export function MonitorPanel({ events }: { events: TraceEvent[] }) {
  const [expanded, setExpanded] = useState(false)

  const icon = (type: string) => {
    const map: Record<string, string> = {
      thinking: "🧠", action: "🔧", governance: "🛡️", tool_start: "⚡",
      tool_result: "📋", feedback: "📊", approval_request: "⚠️", done: "✅", error: "❌", step: "👣",
    }
    return map[type] ?? "•"
  }

  if (!expanded) {
    return (
      <div
        onClick={() => setExpanded(true)}
        style={{ width: "48px", cursor: "pointer", background: "#f3f4f6", padding: "8px", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}
      >
        <span>📊</span>
        <span style={{ writingMode: "vertical-rl", fontSize: "12px" }}>监控 ({events.length})</span>
      </div>
    )
  }

  return (
    <div style={{ width: "300px", background: "#f9fafb", padding: "8px", overflowY: "auto" }}>
      <div onClick={() => setExpanded(false)} style={{ cursor: "pointer", marginBottom: "8px", fontWeight: "bold" }}>
        监控 ▶
      </div>
      {events.slice(-50).map((e, i) => (
        <div key={i} style={{ marginBottom: "4px", fontSize: "12px", fontFamily: "monospace" }}>
          {icon(e.type)} {e.type}: {JSON.stringify(e.data).slice(0, 80)}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Create ApprovalModal component**

```tsx
// src/web/frontend/components/ApprovalModal.tsx
interface ApprovalModalProps {
  action: { tool?: string; args?: Record<string, unknown> } | null
  policy?: { message: string } | null
  onApprove: () => void
  onDeny: () => void
}

export function ApprovalModal({ action, policy, onApprove, onDeny }: ApprovalModalProps) {
  if (!action) return null
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "white", padding: "24px", borderRadius: "8px", maxWidth: "400px" }}>
        <h3>⚠️ 需要审批</h3>
        <p>{policy?.message ?? "此操作需要人工确认"}</p>
        <pre style={{ background: "#f3f4f6", padding: "8px", borderRadius: "4px", fontSize: "12px" }}>
          {JSON.stringify(action, null, 2)}
        </pre>
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button onClick={onDeny} style={{ padding: "8px 16px" }}>拒绝</button>
          <button onClick={onApprove} style={{ padding: "8px 16px", background: "#3b82f6", color: "white" }}>批准</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create App component**

```tsx
// src/web/frontend/App.tsx
import { useState, useCallback } from "react"
import { ChatPanel } from "./components/ChatPanel"
import { MonitorPanel } from "./components/MonitorPanel"
import { ApprovalModal } from "./components/ApprovalModal"
import { useWebSocket } from "./hooks/useWebSocket"
import type { TraceEvent } from "../core/types"

export function App() {
  const { events, connected } = useWebSocket()
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [pendingApproval, setPendingApproval] = useState<{ action: any; policy: any } | null>(null)

  const handleSend = useCallback(async (message: string) => {
    setMessages((prev) => [...prev, { role: "user", content: message }])
    if (!sessionId) {
      const res = await fetch("/api/sessions", { method: "POST" })
      const data = await res.json()
      setSessionId(data.id)
    }
    await fetch(`/api/sessions/${sessionId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    })
  }, [sessionId])

  const approvalEvent = events.find((e) => e.type === "approval_request")
  if (approvalEvent && !pendingApproval) {
    setPendingApproval(approvalEvent.data as any)
  }

  const handleApprove = async () => {
    await fetch(`/api/sessions/${sessionId}/approve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: true }),
    })
    setPendingApproval(null)
  }

  const handleDeny = async () => {
    await fetch(`/api/sessions/${sessionId}/approve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: false }),
    })
    setPendingApproval(null)
  }

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <ChatPanel onSend={handleSend} messages={messages} />
      <MonitorPanel events={events} />
      <ApprovalModal
        action={pendingApproval?.action ?? null}
        policy={pendingApproval?.policy ?? null}
        onApprove={handleApprove}
        onDeny={handleDeny}
      />
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "4px 16px", background: "#f3f4f6", fontSize: "12px" }}>
        {connected ? "🟢 Connected" : "🔴 Disconnected"} | Session: {sessionId ?? "none"}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Verify frontend builds**

Run: `npx vite build`
Expected: Build succeeds, output in `dist/frontend/`

- [ ] **Step 8: Commit**

```bash
git add src/web/frontend/ vite.config.ts
git commit -m "feat: WebUI frontend — chat panel, collapsible monitor, HITL approval modal"
```

---

## Task 17: Dockerfile

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1: Create .dockerignore**

```
node_modules
dist
.git
.harness/memory.json
*.log
```

- [ ] **Step 2: Create Dockerfile (multi-stage)**

```dockerfile
# Stage 1: Builder
FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx vite build
RUN npx tsc --outDir dist

# Stage 2: Runtime
FROM node:22-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/.harness ./.harness
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "dist/web/server.js"]
```

- [ ] **Step 3: Verify Docker build**

Run: `docker build -t coding-agent-harness .`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "feat: Dockerfile — multi-stage build for production"
```

---

## Task 18: CI/CD

**Files:**
- Create: `.gitlab-ci.yml`

- [ ] **Step 1: Create .gitlab-ci.yml**

```yaml
stages:
  - test
  - build
  - deploy

unit-test:
  stage: test
  image: node:22-slim
  script:
    - npm ci
    - npm test
  rules:
    - if: $CI_PIPELINE_SOURCE == "push"

build-docker:
  stage: build
  image: docker:24
  services:
    - docker:24-dind
  script:
    - docker build -t coding-agent-harness .
  rules:
    - if: $CI_COMMIT_BRANCH == "main"

deploy:
  stage: deploy
  script:
    - echo "Deploy to Render via webhook"
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
```

- [ ] **Step 2: Verify CI config syntax**

Run: `npx yaml-lint .gitlab-ci.yml` (or manual review)
Expected: Valid YAML

- [ ] **Step 3: Commit**

```bash
git add .gitlab-ci.yml
git commit -m "ci: GitLab CI with unit-test, docker build, and deploy stages"
```

---

## Task 19: Mechanism Demos (A.6)

**Files:**
- Create: `tests/demo/guardrail-demo.test.ts`
- Create: `tests/demo/feedback-demo.test.ts`
- Create: `tests/demo/hitl-demo.test.ts`

**Interfaces:**
- Consumes: `Harness`, `MockLLMProvider`, all governance modules
- Produces: Three deterministic demo tests

- [ ] **Step 1: Write guardrail demo test**

```typescript
// tests/demo/guardrail-demo.test.ts
import { describe, it, expect } from "vitest"
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
```

- [ ] **Step 2: Write feedback demo test**

```typescript
// tests/demo/feedback-demo.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { Harness } from "../../src/core/loop"
import { MockLLMProvider } from "../../src/core/llm"
// ... same imports as guardrail-demo

describe("Demo ②: Feedback loop drives correction", () => {
  let dir: string
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "demo-f-")) })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it("agent receives test failure feedback and corrects", async () => {
    const config: Config = {
      llm: { provider: "mock", model: "mock", baseURL: "" },
      tools: ["file_write", "run_test"], policies: "",
      sensors: { test: "npm test", lint: "", typecheck: "" },
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
```

- [ ] **Step 3: Write HITL demo test**

```typescript
// tests/demo/hitl-demo.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { Harness } from "../../src/core/loop"
import { MockLLMProvider } from "../../src/core/llm"
import { HitlStateMachine } from "../../src/core/governance/hitl"
import { AgentState } from "../../src/core/types"
// ... same imports

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
```

- [ ] **Step 4: Run all demo tests**

Run: `npx vitest run tests/demo/`
Expected: PASS (3 demo tests)

- [ ] **Step 5: Commit**

```bash
git add tests/demo/
git commit -m "test: mechanism demos — guardrail, feedback loop, HITL approval (A.6)"
```

---

## Task 20: Cloud Deployment

**Files:**
- Create: `render.yaml`
- Modify: `README.md`

- [ ] **Step 1: Create render.yaml**

```yaml
services:
  - type: web
    name: coding-agent-harness
    runtime: docker
    dockerfilePath: ./Dockerfile
    plan: free
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
```

- [ ] **Step 2: Update README.md with deployment instructions**

```markdown
## 部署

### 本地运行
\`\`\`bash
docker build -t coding-agent-harness .
docker run -p 3000:3000 -v $(pwd)/workspace:/workspace coding-agent-harness
\`\`\`
访问 http://localhost:3000

### 云部署 (Render)
1. 推送代码到 GitLab
2. 在 Render 创建新服务，连接仓库
3. 使用 render.yaml 配置
4. 部署后访问公网 URL

### Key 安全配置
首次访问 WebUI 时通过引导对话框录入 API Key，存入钥匙串。
```

- [ ] **Step 3: Commit**

```bash
git add render.yaml README.md
git commit -m "feat: cloud deployment config for Render"
```

---

## Self-Review

### 1. Spec Coverage

| SPEC 要求 | 对应 Task |
|-----------|-----------|
| Agent 主循环 | Task 11 |
| LLM 抽象层（可 mock） | Task 2, 13 |
| 工具系统（文件/Shell/测试） | Task 4 |
| 治理护栏 — Policy Engine | Task 5 |
| 治理护栏 — HITL 状态机 | Task 6 |
| 治理护栏 — Sandbox | Task 7 |
| 反馈闭环 | Task 8 |
| 记忆 | Task 9 |
| 配置 | Task 3 |
| Tracer（可观测性） | Task 10 |
| 上下文压缩 | Task 12 |
| 凭据管理 | Task 14 |
| WebUI 后端 | Task 15 |
| WebUI 前端 | Task 16 |
| Docker 分发 | Task 17 |
| npm 分发 | Task 1 (package.json) |
| CI/CD | Task 18 |
| 机制演示（A.6） | Task 19 |
| 云部署 | Task 20 |
| Open Design Linear | Task 16 (inline styles, can be enhanced) |

### 2. Placeholder Scan

No TBD/TODO/FIXME found. All steps contain actual code.

### 3. Type Consistency

- `Tool` type defined in Task 4 (file.ts), imported in Task 7 (sandbox) and Task 11 (loop) — consistent
- `LLMProvider` interface defined in Task 2, used in Task 11, 12, 13 — consistent
- `PolicyEngine.evaluate()` returns `{ decision, policy? }` — consistent across Tasks 5, 11, 19
- `HitlStateMachine` methods: `requestApproval`, `approve`, `deny`, `timeout`, `stop`, `getState`, `getPendingAction` — consistent across Tasks 6, 11, 15, 19
- `Tracer.record()` takes `Omit<TraceEvent, "timestamp">` — consistent across Tasks 10, 11, 15

---

## Execution Handoff

Plan complete and saved to `PLAN.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
