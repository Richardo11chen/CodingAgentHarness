# AGENT_LOG.md — 实现过程日志

> 按时间顺序记录关键节点。每条包含：时间戳、task 编号、触发的 Superpowers 技能、关键 prompt/context 配置、subagent 输出关键片段或 commit hash、人工干预、学到的教训。

---

## 2026-07-13

### 11:06 — 项目初始化

| 项 | 内容 |
|---|---|
| **时间戳** | 2026-07-13 11:06 |
| **阶段** | 项目初始化 |
| **Superpowers 技能** | `using-superpowers`（自动加载） |
| **操作** | 读取 `docs/通用要求.md` 和 `docs/AI4SE_Final_Project_A_Coding_Agent_Harness.md`，理解项目需求 |
| **关键发现** | 项目 A（Coding Agent Harness）要求：自实现 harness 内核、治理护栏为重点、mock-LLM 单测、WebUI 公网部署、凭据安全、Docker/npm 分发 |
| **教训** | 需求文档有两层：通用要求 + 项目 A 专属要求。必须拼接阅读，不能只看一个。 |

### 11:20 — Superpowers 插件安装

| 项 | 内容 |
|---|---|
| **时间戳** | 2026-07-13 11:20 |
| **阶段** | 环境配置 |
| **Superpowers 技能** | `customize-opencode`（隐式） |
| **操作** | 在 `~/.config/opencode/opencode.jsonc` 中添加 `"plugin": ["superpowers@git+https://github.com/obra/superpowers.git"]` |
| **关键配置** | opencode 全局配置，NJU-SE provider（glm-5.2, deepseek-v4-pro, qwen3.7-max 等） |
| **教训** | Superpowers 通过 opencode 的 plugin 机制安装。配置后需重启 opencode 才生效。当前会话通过手动读取 SKILL.md 来遵循方法论。 |

### 11:30 — Brainstorming 阶段开始

| 项 | 内容 |
|---|---|
| **时间戳** | 2026-07-13 11:30 |
| **阶段** | Brainstorming |
| **Superpowers 技能** | `brainstorming` |
| **关键 prompt** | 逐个提问：技术栈 → 重点维度 → WebUI → 分发 → 凭据 → LLM → Coding 领域 → 架构方案 |
| **关键决策** | TS/Node.js、治理护栏、交互式对话+监控 WebUI、Docker+npm、钥匙串+.env、用户自配 LLM、语言无关 |
| **人工干预** | 1) 纠正 WebUI 必要性（§五 item 9 是硬性要求）；2) 修正凭据安全为纯用户侧；3) 推翻简单截断，改为 LLM 摘要压缩 |
| **教训** | brainstorming 的逐个提问方式有效避免了信息过载。但智能体对需求文档的主动核对不够——WebUI 必要性是用户质疑后才回去核对的。 |

### 12:00 — 设计分节呈现与确认

| 项 | 内容 |
|---|---|
| **时间戳** | 2026-07-13 12:00 |
| **阶段** | Brainstorming — 设计呈现 |
| **Superpowers 技能** | `brainstorming` |
| **设计节** | 1) 系统架构 2) Harness 内核六维度 3) 治理护栏（重点） 4) WebUI 5) 凭据安全 6) 分发部署 7) 测试策略 |
| **关键修正** | 用户分享了 agent loop 参考实现 → 纳入 Tracer、Context compaction、Token budget；WebUI 监控面板改为可折叠；使用 Open Design Linear 设计系统 |
| **教训** | 分节呈现让用户能逐节审阅，避免在错误基础上累积。用户的参考实现比智能体最初设计更完整——brainstorming 是双向的。 |

### 12:30 — SPEC.md 撰写与自审

| 项 | 内容 |
|---|---|
| **时间戳** | 2026-07-13 12:30 |
| **阶段** | Brainstorming — SPEC 撰写 |
| **Superpowers 技能** | `brainstorming`（spec self-review 步骤） |
| **操作** | 撰写 SPEC.md（11 节 + 附录目录结构），执行自审 |
| **自审结果** | 无 TBD/TODO；内部一致性通过；范围聚焦；歧义检查通过。修正了一个代码块格式问题（``` 与标题在同一行）。 |
| **教训** | SPEC 自审有效——发现了格式问题。占位符扫描、一致性检查、范围检查、歧义检查四个维度覆盖了主要问题。 |

### 13:00 — Writing-Plans 阶段

| 项 | 内容 |
|---|---|
| **时间戳** | 2026-07-13 13:00 |
| **阶段** | Writing Plans |
| **Superpowers 技能** | `writing-plans` |
| **操作** | 撰写 PLAN.md，20 个 task，每个含 TDD 步骤（红→绿→重构）、精确文件路径、完整代码 |
| **关键设计** | 7 个阶段：Foundation → Core mechanisms → Integration → Infrastructure → WebUI → Distribution → Demos。依赖图明确标注可并行部分。 |
| **自审** | SPEC 覆盖完整（20 个 task 覆盖 SPEC 全部要求）；无占位符；类型一致性检查通过 |
| **教训** | writing-plans 的"每个 step 包含完整代码"要求让 plan 文件很长（~2000 行），但确保了 subagent 能独立执行。task 颗粒度 2-5 分钟/step 是合理的。 |

### 13:30 — Git Worktree 决策

| 项 | 内容 |
|---|---|
| **时间戳** | 2026-07-13 13:30 |
| **阶段** | 执行准备 |
| **Superpowers 技能** | `using-git-worktrees` |
| **操作** | 检测当前 git 状态（normal repo, main 分支）。征求用户意见后选择直接在 feature 分支开发，不创建 worktree。 |
| **决策** | 创建 `feat/initial-implementation` 分支，提交 SPEC.md 和 PLAN.md |
| **commit** | `7033b5f` — `docs: add SPEC.md and PLAN.md from brainstorming + writing-plans` |
| **教训** | 项目是空仓库时，worktree 的隔离价值有限。feature 分支已足够。 |

### 14:00 — Subagent-Driven Development 启动

| 项 | 内容 |
|---|---|
| **时间戳** | 2026-07-13 14:00 |
| **阶段** | 实现 |
| **Superpowers 技能** | `subagent-driven-development` |
| **操作** | 创建进度 ledger（`.superpowers/sdd/progress.md`），创建 20 个 task 的 todo list，Pre-Flight Plan Review（无冲突） |
| **关键配置** | task-brief 脚本提取 task 文本到文件；review-package 脚本生成 diff 文件 |
| **教训** | 进度 ledger 是防 compaction 的关键——对话记忆不持久，但文件和 git 历史在。 |

### 14:20 — Task 1: Project Scaffolding

| 项 | 内容 |
|---|---|
| **时间戳** | 2026-07-13 14:20 |
| **Task** | 1 — Project Scaffolding |
| **Superpowers 技能** | `subagent-driven-development` + `test-driven-development` |
| **Implementer subagent** | 派发 general subagent，提供 task-1-brief.md + 项目上下文 |
| **subagent 输出** | Status: DONE_WITH_CONCERNS。创建了 package.json, tsconfig.json, vitest.config.ts, .gitignore, src/core/types.ts, .harness/config.yml, .harness/policies.yml, tests/core/scaffold.test.ts |
| **commit** | `8246671` — `feat: project scaffolding with shared types and config` |
| **subagent 关注点** | 1) vitest 的 esbuild 转译器会擦除 `import type`，导致测试在无 types.ts 时也通过——用 `tsc --noEmit` 验证 RED 状态；2) 环境中只有 Windows Node，安装了 nvm + Node.js v22.23.1 |
| **人工干预** | 无（关注点都是环境相关的，不影响正确性） |
| **Task reviewer** | 派发 general subagent，提供 task-1-brief.md + task-1-report.md + review package |
| **review 结果** | Spec ✅, Quality Approved, Verdict: PASS。Minor: 测试质量弱（继承自 brief），.gitignore 有额外条目 |
| **教训** | TDD 的 RED 阶段在 TypeScript 类型测试中有局限——`import type` 在运行时被擦除。需要用 `tsc --noEmit` 来验证类型存在的 RED 状态。subagent 的环境设置（安装 Node.js）是意料之外的，但 subagent 自主解决了。 |

### 14:40 — Task 2: LLM Abstraction Layer

| 项 | 内容 |
|---|---|
| **时间戳** | 2026-07-13 14:40 |
| **Task** | 2 — LLM Abstraction Layer |
| **Superpowers 技能** | `subagent-driven-development` + `test-driven-development` |
| **Implementer subagent** | 派发 general subagent，提供 task-2-brief.md + 项目上下文 |
| **subagent 输出** | Status: DONE。创建了 src/core/llm.ts（LLMProvider 接口 + MockLLMProvider 类） |
| **commit** | `406cb11` — `feat: LLM abstraction layer with MockLLMProvider` |
| **subagent 关注点** | MockLLMProvider 是有状态的（每次 complete() 调用 shift 内部队列），这是有意为之的确定性测试设计 |
| **人工干预** | 无 |
| **Task reviewer** | 派发 general subagent |
| **review 结果** | Spec ✅, Quality Approved, Verdict: PASS。Minor: type-only import 缺少 .js 扩展名（无害），`shift()!` 使用非空断言（有前置 guard 保护） |
| **教训** | 机械性 task（1-2 文件，完整 spec）的 subagent 执行非常顺畅——无需提问，直接实现+测试+提交。review 也快速通过。 |

### 14:50 — 用户要求暂停

| 项 | 内容 |
|---|---|
| **时间戳** | 2026-07-13 14:50 |
| **阶段** | 实现 — 暂停 |
| **操作** | 用户要求在 Task 2 结束后暂停。更新进度 ledger 和 todo list。 |
| **当前状态** | 2/20 task 完成，全部通过评审。分支 feat/initial-implementation 上有 3 个 commit。 |
| **教训** | subagent-driven-development 技能建议"不要在 task 之间暂停"，但用户的判断优先。暂停让用户有机会检查进度和方向。 |

### 15:17 — Task 5: Policy Engine (Cold-start 实现)

| 项 | 内容 |
|---|---|
| **时间戳** | 2026-07-13 15:17 |
| **Task** | 5 — Policy Engine (Governance — Focus) |
| **Superpowers 技能** | `brainstorming` + `test-driven-development` |
| **Agent** | 不同 agent session（冷启动验证，无对话历史） |
| **操作** | TDD: 写 policy.test.ts → RED → 写 policy.ts → GREEN（首次尝试失败，globMatch bug）→ 修复为占位符方案 → GREEN（5 tests pass） |
| **关键发现** | PLAN 的 `globMatch` 代码有 2 个 bug：① `**` 替换不处理嵌套通配 ② 未 escape `.` 等正则特殊字符。PLAN 代码无法通过自身测试 |
| **教训** | PLAN 中的正则/解析类代码如果仅凭经验手写、不经测试验证，会在实现阶段暴露。冷启动 agent 需要自行 debug 修正，浪费时间 |

### 15:20 — Task 8: Feedback System (Cold-start 实现)

| 项 | 内容 |
|---|---|
| **时间戳** | 2026-07-13 15:20 |
| **Task** | 8 — Feedback System (validator + classifier) |
| **Superpowers 技能** | `test-driven-development` |
| **Agent** | 同上（冷启动验证） |
| **操作** | TDD: classifier.test.ts → RED → classifier.ts → GREEN（5 pass）。validator.test.ts → RED → validator.ts → GREEN（3 pass） |
| **关键发现** | 1) PLAN 的 SensorConfig 只有 `{ test: string }`，与 SPEC §3.5 的三传感器配置不一致。Agent 自行加了 `lint/typecheck` 可选字段。2) `classifyFailure` 的 `||`/`&&` 优先级虽碰巧正确但可读性差 |
| **教训** | PLAN 中的接口类型应与 SPEC 定义保持一致（至少字段对齐），避免 agent 被迫偏离 PLAN |

### 15:22 — 冷启动验证记录与 SPEC/PLAN 修订

| 项 | 内容 |
|---|---|
| **时间戳** | 2026-07-13 15:22 |
| **阶段** | 冷启动验证 + 修订 |
| **操作** | 1) 在 SPEC_PROCESS.md §六 中记录完整观察结果（O1-O4 观察节点、D1-D4 分歧、S1-S6 spec 缺陷、P1-P5 plan 缺陷）2) 修订 SPEC.md：§3.4.1 补充 glob 方言和 path_boundary 基准、§3.5 补充分类优先级和传感器调度、§6.1 Policy 新增 appliesTo 字段 3) 修订 PLAN.md：P1 修复 globMatch 为占位符方案、P2 修复 shellExec 签名、P3 classifyFailure 加括号、P4 SensorConfig 扩展为三传感器、P5 新增 path_boundary 测试 |
| **关键修复** | P1 (globMatch) 是最严重的 PLAN bug：如果 agent 完全照搬不测试，会得到错误实现。P2 (shellExec 签名) 会在 Task 4 实现时导致类型不兼容 |
| **总测试结果** | 18 tests / 5 files — all PASS |
| **教训** | 冷启动验证的核心价值在于发现 PLAN 代码的 latent bug——这些 bug 只在实现时才暴露，此时修复代价比在 PLAN 阶段发现要大得多 |

---

## 待续

（后续 task 的记录将在执行时追加）
