# SPEC.md — Coding Agent Harness

> Spec-Driven, Subagent-Built, Human-Owned.
>
> 本文档由 Superpowers `brainstorming` 技能驱动生成，经用户逐节签字确认。

---

## 1. 问题陈述

### 1.1 要解决什么问题

当 LLM 能完成大部分编码"思考"时，一个工程师的真正价值落在 harness 这层工程上——治理、反馈、上下文、安全、分发。**Agent = LLM + Harness**：LLM 相当于 CPU，只负责"决定下一步做什么"；其余全是工程。

本项目要解决的问题是：**如何把一个只会产生下一步设想的 LLM，封装成一台能稳定、可靠工作的编码智能体系统**，并在此过程中对 harness 的核心机制（尤其是治理护栏）形成第一手的工程理解与批判性见解。

### 1.2 目标用户

- **开发者**：希望拥有一个可配置、可治理、可观测的编码智能体，辅助日常编码工作。
- **AI4SE 课程评审者**：通过 WebUI 在线体验 harness 的各项机制（治理拦截、反馈闭环、HITL 审批）。

### 1.3 为什么值得做

1. 市面上的编码智能体（Claude Code、OpenCode 等）是黑箱——用户无法控制其治理逻辑。本项目让治理透明、可配置、可测试。
2. 治理护栏是 AI 协作中最容易松懈的纪律——"让 LLM 注意安全"是一句提示词，不是一个机制。本项目把治理落实为确定性代码。
3. 通过"用一个 harness（Superpowers）去造另一个 harness"，对这套方法论形成第一手批判性理解。

---

## 2. 用户故事

遵循 INVEST 原则（Independent, Negotiable, Valuable, Estimable, Small, Testable）。

### US-1：安全录入 API Key

> 作为一名开发者，我希望首次使用 harness 时通过 WebUI 安全录入我的 LLM API Key（隐藏输入），以便 harness 能代表我调用 LLM，而我的 Key 不会被泄露。

**验收**：首次访问 WebUI 时弹出引导对话框；输入框为 password 类型；Key 存入 OS 钥匙串；刷新页面后不再要求输入。

### US-2：与 Agent 对话编码

> 作为一名开发者，我希望在 WebUI 中用自然语言描述编码任务（如"修复失败的测试"），让 agent 自主读写文件、执行命令、运行测试，以便我不用手动操作每一步。

**验收**：发送消息后 agent 开始工作；WebUI 实时显示 agent 的思考、工具调用、执行结果；agent 完成后给出总结。

### US-3：危险动作审批

> 作为一名开发者，我希望当 agent 试图执行危险操作（如 `git push --force`、删除文件）时，harness 暂停并弹出审批对话框，以便我能阻止或批准该操作。

**验收**：危险动作触发时 agent 循环暂停；WebUI 弹出 modal 显示动作详情和匹配策略；用户批准后继续执行，拒绝后跳过并回灌拒绝消息。

### US-4：测试反馈驱动自我修正

> 作为一名开发者，我希望 agent 修改代码后自动运行测试，如果测试失败则将失败信息回灌给 agent 使其自我修正，以便 agent 能自主完成"修改→测试→修正"的闭环。

**验收**：agent 修改代码后自动运行配置的测试命令；测试失败时反馈报告（含失败分类）回灌给 agent；agent 在下一轮动作中尝试修正；修正后再次运行测试。

### US-5：配置治理规则

> 作为一名开发者，我希望通过配置文件声明哪些操作是禁止的、哪些需要审批，以便我能根据项目特点定制治理策略。

**验收**：`.harness/policies.yml` 中定义规则；agent 执行动作时按规则匹配；WebUI 可查看当前生效规则；修改规则后下次动作生效。

### US-6：查看 Agent 运行历史

> 作为一名开发者，我希望查看 agent 的运行轨迹（每步的思考、动作、结果、治理决策），以便我能理解 agent 的行为并调试问题。

**验收**：每次 agent 运行生成 trace 记录；WebUI 监控面板实时展示事件流；trace 可导出供事后回放。

---

## 3. 功能规约

按模块拆分。每项描述输入 / 行为 / 输出 / 边界条件 / 错误处理。

### 3.1 Agent 主循环（决策封装）

| 项 | 描述 |
|---|---|
| **输入** | 用户消息（goal）、配置（系统提示词、规则文件、策略、工具列表、反馈命令） |
| **行为** | 组织上下文 → 调用 LLM → 解析响应为动作 → 治理检查 → 分发执行 → 回灌结果 → 反馈校验 → 停机判断 |
| **输出** | AgentResult（最终回答、步数、trace） |
| **边界** | 最大步数（MAX_STEPS，默认 50）、超时（默认 300s）、上下文窗口溢出时压缩 |
| **错误** | LLM 调用失败 → 重试 3 次后报错；动作解析失败 → 回灌错误让 LLM 重试；工具执行异常 → 捕获并回灌 |

### 3.2 LLM 抽象层

| 项 | 描述 |
|---|---|
| **输入** | messages（消息列表）、options（model、temperature、max_tokens） |
| **行为** | 调用 OpenAI-compatible API（真实）或返回预编排响应（mock） |
| **输出** | LLMResponse（text、action） |
| **边界** | 支持任意 OpenAI-compatible 端点；用户在配置中指定 baseURL、model、apiKey |
| **错误** | 网络超时 → 重试；401 鉴权失败 → 提示用户检查 Key；429 限流 → 指数退避 |

### 3.3 工具系统

| 工具 | 输入 | 行为 | 输出 | 边界/错误 |
|------|------|------|------|-----------|
| `file_read` | `{ path: string }` | 读取文件内容 | `{ success, content, error }` | 路径必须在项目目录内；不存在返回 error |
| `file_write` | `{ path: string, content: string }` | 写入文件 | `{ success, error }` | 路径必须在项目目录内；权限不足返回 error |
| `file_delete` | `{ path: string }` | 删除文件 | `{ success, error }` | 路径必须在项目目录内；治理默认 ask |
| `shell_exec` | `{ command: string }` | 执行 shell 命令 | `{ success, stdout, stderr, exitCode }` | 超时 30s；治理检查命令模式 |
| `run_test` | `{ command: string }` | 运行测试命令 | `{ success, output, passed, failed }` | 解析输出判定 pass/fail |

### 3.4 治理护栏（重点维度）

#### 3.4.1 Policy Engine（策略引擎）

| 项 | 描述 |
|---|---|
| **输入** | Action（工具名 + 参数） |
| **行为** | 逐条匹配策略规则（命令模式、路径边界、路径模式），返回首个匹配的决策 |
| **输出** | `{ decision: "allow" \| "deny" \| "ask", policy?: Policy }` |
| **边界** | 无匹配规则时默认 allow；规则从 `.harness/policies.yml` 加载 |
| **错误** | 规则文件格式错误 → 使用默认规则并警告 |

**策略规则类型**：
- `command_pattern`：正则匹配 shell 命令
- `path_boundary`：路径必须在指定边界内
- `path_pattern`：glob 匹配文件路径

#### 3.4.2 HITL 状态机

| 项 | 描述 |
|---|---|
| **输入** | requestApproval(action) / approve() / deny() / timeout() |
| **行为** | 状态转换：Running → PendingApproval → Running |
| **输出** | getState() → AgentState；approve() → Action（待执行） |
| **边界** | 审批超时默认 120s，超时自动 deny；同一时刻只有一个 pending action |
| **错误** | 非法状态转换 → 忽略并记录 |

**状态转换**：
```
Running ──(guardrail: ask)──→ PendingApproval
  ↑                                 │
  │                          ┌───────┼───────┐
  │                          │       │       │
  │                      approve    deny   timeout
  │                          │       │       │
  └──────────────────────────┘       │       │
       (execute action)               │       │
  ← (feed back denial) ──────────────┘       │
  ← (feed back auto-deny) ───────────────────┘
```

#### 3.4.3 Sandbox（沙箱）

| 项 | 描述 |
|---|---|
| **输入** | Tool + ToolArgs |
| **行为** | 验证路径边界 → 执行工具 → 捕获结果 |
| **输出** | ToolResult |
| **边界** | 文件操作限制在 PROJECT_DIR 内；shell 执行超时 30s；环境变量隔离 |
| **错误** | 路径越界 → 拒绝并返回 error；超时 → 终止进程并返回 timeout error |

### 3.5 反馈闭环

| 项 | 描述 |
|---|---|
| **输入** | Action（changedCode=true）+ 工具执行结果 |
| **行为** | 运行配置的传感器命令（test/lint/typecheck）→ 解析输出 → 客观判定 → 分类失败 |
| **输出** | FeedbackReport（passed, failures[], category） |
| **边界** | 传感器命令在配置中声明；输出解析支持常见格式（JUnit、tap、文本） |
| **错误** | 传感器命令执行失败 → 返回 unknown 状态；解析失败 → 返回原始输出 |

**失败分类**：`syntax_error` / `test_failure` / `type_error` / `lint_violation` / `unknown`

### 3.6 记忆

| 项 | 描述 |
|---|---|
| **输入** | read(query) / write(note) / consolidate(context) |
| **行为** | read：关键词匹配检索；write：追加笔记；consolidate：会话结束时固化 |
| **输出** | read → 相关记忆条目列表；write/consolidate → void |
| **边界** | 存储于 `.harness/memory.json`；最大 1000 条；LRU 淘汰 |
| **错误** | 文件读写失败 → 降级为空记忆，不影响主循环 |

### 3.7 配置

| 项 | 描述 |
|---|---|
| **输入** | `.harness/config.yml` |
| **行为** | 加载配置：LLM provider/model、工具列表、策略文件路径、传感器命令、沙箱限制 |
| **输出** | Config 对象 |
| **边界** | 缺失字段使用默认值；WebUI 可查看和修改 |
| **错误** | 配置文件不存在 → 使用全默认配置并引导用户；格式错误 → 报错并指出行号 |

### 3.8 Tracer（可观测性）

| 项 | 描述 |
|---|---|
| **输入** | record(text, action) / record(result) / record(feedback) |
| **行为** | 记录每步的（决策, 观察）对；实时推送到 WebUI |
| **输出** | export() → Trace（事件列表） |
| **边界** | 内存中保留最近 500 条；会话结束时落盘 |
| **错误** | 落盘失败 → 保留内存中的记录，警告 |

### 3.9 WebUI

| 项 | 描述 |
|---|---|
| **输入** | 用户消息、审批操作、配置修改 |
| **行为** | 提供对话界面 + 可折叠监控面板 + HITL 审批 modal + 配置面板 |
| **输出** | 实时事件流（WebSocket）、HTTP 响应 |
| **边界** | 使用 Open Design Linear 设计系统；监控面板默认折叠 |
| **错误** | WebSocket 断开 → 自动重连；API 错误 → 显示错误提示 |

### 3.10 凭据管理

| 项 | 描述 |
|---|---|
| **输入** | 录入/更新/清除 API Key |
| **行为** | 主方案存入 OS 钥匙串（keytar）；回退方案存入 .env（权限 600） |
| **输出** | 状态查询返回 `{ hasKey: boolean, provider: string }`（不回显明文） |
| **边界** | 首次运行引导录入；查看状态不回显明文 |
| **错误** | 钥匙串不可用 → 回退到 .env 并警告；Key 无效 → LLM 调用时 401 报错 |

---

## 4. 非功能性需求

### 4.1 性能

- Agent 主循环单步延迟 < 5s（不含 LLM 响应时间）
- WebUI WebSocket 事件推送延迟 < 100ms
- 工具执行超时 30s（shell）、300s（测试）
- 上下文窗口溢出时 LLM 摘要压缩耗时 < 10s（含一次 LLM 调用）

### 4.2 安全（含凭据威胁模型）

**凭据威胁模型（针对用户的 API Key）**：

| 威胁 | harness 的对策 |
|------|---------------|
| Key 存储为明文 | OS 钥匙串加密存储；.env 仅回退并说明明文风险 |
| Key 进入终端 history | 不用 `export`，通过 WebUI/钥匙串录入 |
| Key 被 harness 写入日志 | 日志框架过滤 `apiKey`/`authorization` 字段 |
| Key 在 .env 中被其他进程读取 | 文件权限 600 + `.gitignore` 排除 + SPEC 说明风险 |
| Key 在传输中被截获 | 生产部署使用 HTTPS |

**治理安全**：
- 危险动作拦截是代码机制（Policy Engine），不依赖 LLM 遵从提示词
- Sandbox 强制路径边界，防止 agent 读写项目目录外文件
- HITL 审批超时自动拒绝，防止无限等待

### 4.3 可用性

- WebUI 界面遵循 Open Design Linear 设计系统，简洁、开发者友好
- 首次使用引导流程：录入 Key → 配置项目 → 开始对话
- 监控面板可折叠，不干扰对话体验
- 错误信息清晰可读，含建议操作

### 4.4 可观测性

- Tracer 记录每步（思考、动作、治理决策、工具结果、反馈）
- WebUI 实时展示事件流
- Trace 可导出供事后回放
- 日志分级（debug/info/warn/error），敏感字段过滤

---

## 5. 系统架构

### 5.1 三层架构

```
┌───────────────────────────────────────────────────┐
│                 WebUI 层（交付界面）                │
│  ┌─────────────┐  ┌────────────────────────────┐  │
│  │ React 前端   │  │ Express API + WebSocket    │  │
│  │ 对话 + 监控  │←→│ 实时推送 agent 状态/工具调用 │  │
│  │ (Open Design │  │                            │  │
│  │  Linear)     │  │                            │  │
│  └─────────────┘  └────────────────────────────┘  │
├───────────────────────────────────────────────────┤
│              Harness 内核层（核心交付物）            │
│  ┌─────────────────────────────────────────────┐   │
│  │            Agent 主循环                      │   │
│  │  组织上下文→调用LLM→解析动作→治理检查→分发   │   │
│  │  执行→回灌结果→反馈校验→停机判断             │   │
│  └─────────────────────────────────────────────┘   │
│  ┌──────┐ ┌──────────┐ ┌────────┐ ┌──────┐ ┌────┐ │
│  │LLM   │ │工具系统   │ │治理护栏│ │反馈  │ │记忆│ │
│  │抽象层│ │文件/Shell│ │(重点)  │ │闭环  │ │    │ │
│  │可mock│ │/测试运行 │ │HITL    │ │校验器│ │    │ │
│  └──────┘ └──────────┘ └────────┘ └──────┘ └────┘ │
│  ┌──────────┐  ┌──────────┐                        │
│  │配置系统   │  │Tracer    │                        │
│  └──────────┘  └──────────┘                        │
├───────────────────────────────────────────────────┤
│                 基础设施层                          │
│  凭据管理（钥匙串+.env）│ LLM API Client │ Docker  │
└───────────────────────────────────────────────────┘
```

### 5.2 数据流

1. 用户通过 WebUI 发送消息 → POST `/api/sessions/:id/message`
2. Express 启动 agentLoop（异步）
3. 主循环：组织上下文 → 调用 LLM → 解析动作
4. 动作经治理护栏检查：
   - `allow` → 继续
   - `deny` → 记录拒绝，回灌给 LLM
   - `ask` → HITL 暂停 → WebSocket 推送 `approval_request` → 等待用户审批
5. 工具执行（经 Sandbox）→ 结果 + 反馈回灌
6. 全程通过 WebSocket 实时推送事件到 WebUI
7. 停机 → 推送 `done` 事件 → 会话结束

### 5.3 外部依赖

| 依赖 | 用途 | 备注 |
|------|------|------|
| OpenAI-compatible LLM API | LLM 调用 | 用户自配 provider/model/key |
| keytar (npm) | OS 钥匙串访问 | 跨平台 |
| Express (npm) | HTTP API 服务 | |
| ws (npm) | WebSocket | 实时事件推送 |
| React + Vite (npm) | 前端框架 | |
| Vitest (npm) | 测试框架 | TDD + mock LLM 单测 |
| Open Design | 设计系统 | Linear 设计系统 |

---

## 6. 数据模型

### 6.1 主要实体

```typescript
// 消息
interface Message {
  role: "system" | "user" | "assistant"
  content: string
  action?: Action        // assistant 消息可附带动作
}

// 动作
interface Action {
  type: "call_tool" | "done" | "take_note"
  tool?: string          // 工具名（call_tool 时）
  args?: ToolArgs        // 工具参数
  changedCode?: boolean  // 是否修改了代码（触发反馈）
  text?: string          // done 时的最终回答
  note?: string          // take_note 时的笔记内容
}

// 工具参数
interface ToolArgs {
  path?: string
  content?: string
  command?: string
}

// 工具结果
interface ToolResult {
  success: boolean
  content?: string
  stdout?: string
  stderr?: string
  exitCode?: number
  error?: string
}

// 治理决策
type GuardrailDecision = "allow" | "deny" | "ask"

// 策略规则
interface Policy {
  name: string
  type: "command_pattern" | "path_boundary" | "path_pattern"
  pattern: string
  decision: GuardrailDecision
  message: string
  except?: string         // path_boundary 的例外
}

// 反馈报告
interface FeedbackReport {
  passed: boolean
  failures: Failure[]
  category: FailureCategory
  rawOutput: string
}

// 失败条目
interface Failure {
  message: string
  file?: string
  line?: number
}

// 失败分类
type FailureCategory = "syntax_error" | "test_failure" | "type_error" | "lint_violation" | "unknown"

// Agent 状态
enum AgentState { Running, PendingApproval, Stopped }

// Trace 事件
interface TraceEvent {
  timestamp: number
  type: "thinking" | "action" | "governance" | "tool_start" | "tool_result" | "feedback" | "approval_request" | "step" | "done" | "error"
  data: any
}

// Agent 结果
interface AgentResult {
  answer: string | null
  steps: number
  trace: TraceEvent[]
}

// 配置
interface Config {
  llm: { provider: string, model: string, baseURL: string }
  tools: string[]
  policies: string        // 策略文件路径
  sensors: { test: string, lint: string, typecheck: string }
  sandbox: { timeout: number, maxMemory: number }
  maxSteps: number
  timeout: number
}
```

### 6.2 关系

- Session 1→* Message（一个会话多条消息）
- Message 1→1 Action（assistant 消息可附带一个动作）
- Action 1→1 GuardrailDecision（每个动作经一次治理检查）
- Action 1→1 ToolResult（每个动作产生一个结果）
- Action 1→? FeedbackReport（changedCode 时产生反馈）
- Session 1→* TraceEvent（一个会话多条 trace 事件）

### 6.3 约束

- 文件路径必须在 PROJECT_DIR 内（Sandbox 强制）
- 同一时刻只有一个 pending action（HITL 约束）
- MAX_STEPS 默认 50，可配置
- 记忆最大 1000 条，LRU 淘汰
- Trace 内存中保留最近 500 条

---

## 7. 领域与机制设计（A.5 额外要求）

### 7.1 Coding 领域的四类机制

| 机制 | 领域特征 | 编码实现 |
|------|---------|---------|
| **动作/工具** | 读写文件、执行 shell、运行测试 | `tools/` 模块：每个工具是独立函数，经 Sandbox 执行 |
| **客观反馈信号** | 测试/lint/类型检查的输出 | `feedback/` 模块：校验器解析命令输出 → 客观判定 → 回灌 |
| **危险动作** | `rm -rf`、`git push --force`、删数据库、写 .env | `governance/` 模块：Policy Engine 匹配 → 拦截/审批 |
| **记忆** | 项目约定、历史决策、代码库知识 | `memory/` 模块：文件型 KV 存储 + 关键词检索 |

### 7.2 重点维度：治理护栏

**选择理由**：
1. 治理是 AI 协作中最容易松懈的纪律——"让 LLM 注意安全"是一句提示词，不是一个机制。本项目把治理落实为确定性代码。
2. 治理天然由代码构成（模式匹配、状态机、沙箱），深入实现后最能体现工程深度。
3. 治理的每个子机制都可用 mock LLM 确定性单测，完美契合 A.4-C 的"移除 LLM 后仍可验证"判据。

**深入实现的内容**：
- **Policy Engine**：声明式规则（YAML），支持命令模式/路径边界/路径模式三种匹配类型
- **HITL 状态机**：Running ↔ PendingApproval 的确定性状态转换，含超时自动拒绝
- **Sandbox**：文件系统边界 + shell 超时 + 环境隔离
- **策略可配置**：用户通过 `.harness/policies.yml` 自定义治理规则

### 7.3 机制编码实现（呼应 A.4）

所有机制均为**代码**，不是提示词：

- **反馈信号** = `FeedbackValidator` 类（解析产物 → 客观判定 → 回灌），不是"让 LLM 自检"的提示
- **危险动作拦截** = `PolicyEngine.evaluate(action)` 函数（匹配 → 拦截/审批），不是"提醒 LLM 注意安全"的提示
- **沙箱边界** = `Sandbox.run()` 方法（路径验证 → 执行 → 超时控制），不是"限制在项目目录"的提示

**判定标准**：移除真实 LLM 后，注入 MockLLMProvider，所有机制仍能用确定性单元测试验证。

---

## 8. 凭据与分发设计

### 8.1 凭据存储方案

**主方案：OS 钥匙串**（通过 `keytar` 库）
- macOS: Keychain
- Windows: Credential Manager
- Linux: Secret Service (libsecret)

**回退方案：.env 文件**
- 通过 `dotenv` 加载
- 文件权限 600
- `.gitignore` 排除
- SPEC 明确说明明文风险：`.env` 为明文、进程环境可见

### 8.2 凭据管理流程

```
首次使用:
  WebUI 引导 → 隐藏输入 API Key → 存入钥匙串

查看状态:
  GET /api/credentials → { hasKey: true, provider: "..." }  // 不回显明文

更新:
  POST /api/credentials { key: "sk-xxx" } → 更新钥匙串

清除:
  DELETE /api/credentials → 删除钥匙串中的 key
```

### 8.3 分发形态

**Docker 容器**：
```bash
docker build -t coding-agent-harness .
docker run -p 3000:3000 -v $(pwd)/workspace:/workspace coding-agent-harness
```
- 多阶段构建（builder + runtime）
- Key 配置：首次运行通过 WebUI 引导录入

**npm 包**：
```bash
npm install -g coding-agent-harness
coding-agent-harness  # 启动本地服务，浏览器打开 localhost:3000
```

### 8.4 目标平台

- Docker：Linux x86_64 / ARM64（Docker 环境即可）
- npm：macOS / Windows / Linux（Node.js 22+）
- 云部署：Render（免费额度，Docker 镜像部署）

### 8.5 Key 在目标机的安全配置

1. Docker：`docker run` 后访问 `http://localhost:3000`，通过 WebUI 引导录入 Key，存入容器内钥匙串
2. npm：安装后运行，通过 WebUI 引导录入 Key，存入本机钥匙串
3. .env 回退：在项目目录创建 `.env` 文件，写入 `LLM_API_KEY=sk-xxx`，文件权限 600

---

## 9. 技术选型与理由

### 9.1 语言：TypeScript / Node.js

- 原生异步 I/O 适合 LLM API 调用和 WebSocket 推送
- WebUI 生态最成熟（React + Express）
- Vitest 测试框架原生支持 TS，适合 TDD
- npm + Docker 双分发均可
- opencode/Superpowers 生态本身是 TS，可参考其实现

### 9.2 后端框架：Express

- 最成熟的 Node.js HTTP 框架
- 中间件生态丰富
- 简单直接，适合 API 服务

### 9.3 前端框架：React + Vite

- React 生态最成熟，组件化适合对话 + 监控面板
- Vite 构建速度快，HMR 开发体验好
- 与 Open Design 兼容

### 9.4 设计系统：Open Design — Linear

- 通用要求 §3.6 要求前端项目使用 Open Design
- Linear 设计系统简洁、开发者风格，适合开发者工具的 WebUI
- 提供完整的配色、字体、间距、组件规范

### 9.5 测试框架：Vitest

- 原生 TypeScript 支持
- 内置 mock/spy，适合 mock LLM 单测
- 快速，适合 TDD 的红-绿-重构循环
- `npm test` 一键运行

### 9.6 LLM 供应商：用户自配

- harness 的 LLM 抽象层支持任意 OpenAI-compatible API
- 用户在配置中指定 baseURL、model、apiKey
- 不绑定特定供应商，最大灵活性

### 9.7 分发与部署：Docker + npm + Render

- Docker：通用容器分发，CI 中构建镜像
- npm：Node.js 用户一键安装
- Render：免费额度，支持 Docker 部署，提供公网 URL

---

## 10. 验收标准

### 10.1 Harness 内核

| 功能 | 完成判定 |
|------|---------|
| Agent 主循环 | mock LLM 下能完成"接收 goal → 执行动作 → 返回结果"全流程 |
| LLM 抽象层 | RealLLMProvider 和 MockLLMProvider 实现同一接口，可互换 |
| 工具系统 | file_read/file_write/shell_exec/run_test 各自通过单元测试 |
| 治理护栏 | Policy Engine 匹配危险动作返回 deny/ask；HITL 状态机转换正确；Sandbox 拦截越界路径 |
| 反馈闭环 | 校验器解析测试输出判定 pass/fail；失败分类正确；反馈回灌后 mock LLM 下一轮动作改变 |
| 记忆 | write → read 能检索到写入内容；consolidate 后跨会话可读 |
| 配置 | 加载 YAML 配置；缺失字段使用默认值；WebUI 可查看 |
| Tracer | 记录每步事件；export() 返回完整 trace |

### 10.2 WebUI

| 功能 | 完成判定 |
|------|---------|
| 对话面板 | 发送消息 → 收到 agent 回复 |
| 监控面板 | 实时显示 thinking/action/governance/tool/feedback 事件 |
| HITL 审批 | 危险动作弹出 modal → 批准/拒绝后 agent 继续 |
| 配置面板 | 可查看配置和凭据状态 |
| 可折叠 | 监控面板可折叠/展开 |

### 10.3 凭据管理

| 功能 | 完成判定 |
|------|---------|
| 首次引导 | 首次访问弹出录入对话框 |
| 安全存储 | Key 存入钥匙串（或 .env 回退） |
| 不回显明文 | GET /api/credentials 不返回 key 明文 |
| 更新/清除 | POST/DELETE 能更新/清除 key |

### 10.4 分发

| 功能 | 完成判定 |
|------|---------|
| Docker | `docker build` + `docker run` 可启动 |
| npm | `npm install -g` + 命令可启动 |
| 云部署 | 公网 URL 可访问 |

### 10.5 测试

| 功能 | 完成判定 |
|------|---------|
| 单元测试 | `npm test` 一键运行，全部通过 |
| Mock LLM | 核心机制测试不依赖网络和真实 LLM |
| 机制演示 | ① 护栏拦截 ② 反馈闭环 ③ HITL 流程，确定性复现 |
| CI | `.gitlab-ci.yml` 含 unit-test job，最后一次 pass |

---

## 11. 风险与未决问题

### 11.1 技术风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| LLM 响应格式不稳定 | 动作解析失败 | 设计容错解析器；解析失败时回灌错误让 LLM 重试 |
| 上下文窗口溢出 | agent 丢失关键信息 | LLM 摘要压缩：保留 system prompt + 最近 N 条消息，较早消息由 LLM 生成结构化摘要替换 |
| keytar 在 Linux 无 Secret Service | 凭据存储失败 | 回退到 .env 并警告；README 说明 Linux 依赖 |
| Docker 容器内钥匙串不可用 | 凭据存储失败 | 容器内使用 .env 方案；README 说明 |
| WebSocket 连接不稳定 | 监控面板断更 | 自动重连机制 |

### 11.2 Scope 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| 治理维度深入不够 | 不满足 A.4-D | 确保 Policy Engine + HITL + Sandbox 三者都有完整实现和测试 |
| WebUI 工作量过大 | 挤占内核实现时间 | WebUI 保持简洁；监控面板可折叠；用 Open Design 减少设计工作 |
| 分发+部署耗时 | 挤占核心开发 | Docker 多阶段构建模板化；Render 部署自动化 |

### 11.3 未决问题

1. **LLM 响应格式**：是否使用 function calling / tool use 的原生 API 格式，还是自定义文本协议？→ 倾向于使用 OpenAI tool calling 格式，但需在实现时验证。
2. **上下文压缩策略**：采用 LLM 摘要压缩。当 token 数接近窗口上限时，保留 system prompt + 最近 N 条消息，将较早的消息交由 LLM 生成结构化摘要（关键决策、已执行动作、已知事实），替换原始消息。压缩本身是一次 LLM 调用。
3. **多会话并发**：是否支持多个 agent 会话同时运行？→ 初版支持单会话，架构上预留多会话扩展。

---

## 附录：项目目录结构

```
coding-agent-harness/
├── src/
│   ├── core/                   # Harness 内核
│   │   ├── loop.ts             # Agent 主循环
│   │   ├── llm.ts              # LLM 抽象层（RealLLMProvider + MockLLMProvider）
│   │   ├── tools/              # 工具系统
│   │   │   ├── file.ts         # file_read / file_write / file_delete
│   │   │   ├── shell.ts        # shell_exec
│   │   │   └── test.ts         # run_test
│   │   ├── governance/         # 治理护栏（重点维度）
│   │   │   ├── policy.ts       # Policy Engine
│   │   │   ├── hitl.ts         # HITL 状态机
│   │   │   └── sandbox.ts     # Sandbox
│   │   ├── feedback/           # 反馈闭环
│   │   │   ├── validator.ts    # 校验器
│   │   │   └── classifier.ts   # 失败分类器
│   │   ├── memory.ts           # 记忆
│   │   ├── config.ts           # 配置
│   │   └── tracer.ts           # 可观测性
│   ├── web/                    # WebUI
│   │   ├── server.ts           # Express API + WebSocket
│   │   ├── routes/             # API 路由
│   │   │   ├── sessions.ts     # 会话管理
│   │   │   ├── config.ts       # 配置管理
│   │   │   └── credentials.ts  # 凭据管理
│   │   └── frontend/          # React 前端
│   │       ├── App.tsx
│   │       ├── components/     # 对话面板、监控面板、审批 modal
│   │       └── hooks/          # WebSocket hook
│   └── credentials/            # 凭据管理
│       ├── keychain.ts         # OS 钥匙串
│       └── env.ts             # .env 回退
├── tests/                      # Vitest 测试
│   ├── core/                   # 内核单测（mock LLM）
│   │   ├── loop.test.ts
│   │   ├── llm.test.ts
│   │   ├── tools.test.ts
│   │   ├── governance/         # 治理护栏测试
│   │   │   ├── policy.test.ts
│   │   │   ├── hitl.test.ts
│   │   │   └── sandbox.test.ts
│   │   ├── feedback.test.ts
│   │   ├── memory.test.ts
│   │   └── config.test.ts
│   ├── integration/            # 集成测试
│   │   └── agent-loop.test.ts
│   └── demo/                   # 机制演示（A.6）
│       ├── guardrail-demo.test.ts
│       ├── feedback-demo.test.ts
│       └── hitl-demo.test.ts
├── .harness/                   # 用户配置目录
│   ├── config.yml              # 配置文件
│   ├── policies.yml            # 策略规则
│   └── memory.json             # 记忆存储
├── Dockerfile                  # Docker 分发
├── .gitlab-ci.yml              # CI 配置
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```
