# SPEC_PROCESS.md — 与 Superpowers 协作生成 Spec 与 Plan 的过程

> 本文档记录使用 Superpowers `brainstorming` + `writing-plans` 技能协作生成 SPEC.md 和 PLAN.md 的全过程。

---

## 一、Brainstorming 关键节点

### 节点 1：技术栈选择

**智能体提问**："你的 Coding Agent Harness 打算用什么语言/技术栈实现？这会影响后续所有设计决策。"

**我的决策**：选择 TypeScript/Node.js。理由是原生异步 I/O 适合 LLM API 调用、WebUI 生态最成熟、Vitest 测试框架优秀、opencode/Superpowers 生态本身是 TS。

**智能体的贡献**：智能体在选项中标注了"推荐"并给出了理由（WebUI 生态、异步 I/O、测试框架），这个推荐是合理的，我采纳了。

### 节点 2：重点维度选择

**智能体提问**："六个维度（决策/工具/记忆/治理/反馈/配置）都要有最低实现，但必须选一个深入做。你选哪个作为重点维度？"

**我的决策**：选择治理/护栏。理由是治理是 AI 协作中最容易松懈的纪律——"让 LLM 注意安全"是一句提示词，不是一个机制。治理天然由代码构成，深入实现后最能体现工程深度。

**智能体的贡献**：智能体在选项中标注了"推荐"并说明了"代码密集，最容易做深，也最契合'机制必须是代码'的要求"。这个推荐与我的判断一致。

### 节点 3：WebUI 是否必需（关键修正）

**我的原设想**：harness 类似于 Claude Code / OpenCode，是 CLI 工具，不需要 WebUI。

**智能体的追问**：智能体在凭据安全环节发现我对 WebUI 的疑问，主动回到需求文档 §五 第 9 条确认"线上部署 URL，**必须**提供应用可访问的 WebUI 接口"。

**我的处理决策**：接受了智能体的纠正。智能体引用了 §五 交付物清单和 §4.11 云部署条款，明确区分了"必须"（§五）和"可选择"（§4.11 的平台选择）。这是一个重要的修正——我最初误读了 §4.11 的"如做带服务端的项目"为条件句，实际上 §五 的交付物清单才是权威。

**反思**：这个节点体现了 brainstorming 技能的价值——智能体不像人一样有"先入为主"的偏见，它会回到原始文档逐条核对，发现了我遗漏的硬性要求。

### 节点 4：凭据安全的对象（关键修正）

**我的原设想**：凭据安全同时针对开发者和用户。

**我的提问**："这个coding agent harness我一开始认为是做类似于claude code，opencode这种的，所以我觉得不需要webui"

**智能体的处理**：先澄清了 WebUI 的必要性（见节点 3），然后在凭据安全环节，我进一步质疑"但是我做这个项目也不需要什么key啊，这只是一个harness，所以只要针对用户就行了吧"。

**智能体的纠正**：完全正确。harness 是一个产品，开发者自己不需要 API key——需要 key 的是 harness 的使用者。智能体将威胁模型从"开发者自查清单"修正为"纯用户侧功能模块"。

**反思**：这个节点暴露了我设计中的一个概念混淆——把开发纪律（不硬编码、不提交 Git）当成了产品功能。brainstorming 技能通过逐个提问的方式，帮助我区分了"开发者侧"和"用户侧"两个不同的关注点。

### 节点 5：Agent 主循环对齐

**我的输入**：我分享了一份详细的 agent loop 参考实现（包含 build_agent 装配、主循环、收尾三阶段），问"这个和你的差不多吗"。

**智能体的处理**：智能体对比了参考实现和自己的设计，发现缺失了几个概念：
- **Tracer（可观测性）**：缺失 → 纳入（WebUI 实时监控本来就需要）
- **Context compaction（熵管理）**：缺失 → 纳入（长对话必须处理窗口溢出）
- **Token budget**：只有 max_steps → 扩展（加超时和费用预算）
- **Skills**：缺失 → 简化纳入（启动时加载规则文件）
- **Hooks**：缺失 → 简化纳入（作为治理的扩展点）
- **MCP / Subagent**：缺失 → 不做（scope 外）

**我的处理决策**：采纳了 Tracer、Context compaction、Token budget 的纳入；同意 MCP 和 Subagent 不做。更新了主循环伪代码，与参考实现对齐。

**反思**：这个节点体现了"与智能体共同设计"的价值。我提供的参考实现比智能体最初的设计更完整，智能体能够识别差异并选择性纳入。这说明 brainstorming 不是单向的"智能体问我答"，而是双向的质询与修正。

### 节点 6：上下文压缩策略（用户推翻）

**智能体的原设想**：先实现简单截断（保留最近 N 条消息），摘要作为可选增强。

**我的修正**："上下文压缩策略我不想做简单截断"。

**智能体的处理**：更新为 LLM 摘要压缩——当 token 数接近窗口上限时，保留 system prompt + 最近 N 条消息，将较早的消息交由 LLM 生成结构化摘要替换。

**反思**：这是用户推翻 AI 建议的案例。智能体的"先简单后复杂"策略在工程上是合理的，但我认为简单截断会丢失关键上下文，不值得作为"第一步"——不如直接做 LLM 摘要。brainstorming 技能在这里允许了用户的推翻，这是正确的——用户对自己的项目有更好的判断。

---

## 二、至少 3 轮关键迭代的对话节选与处理决策

### 迭代 1：WebUI 的必要性

**对话节选**：

> 用户："但是他不是说如果做带服务端的项目才要这样吗，我做harness不需要吧"
>
> 智能体："关键在于 §五（最终交付物清单）和 §4.11（云部署）是两个不同层级的条款……§五 item 9 说'线上部署 URL，**必须**提供应用可访问的 WebUI 接口'。这里的'必须'是加粗的，且这一条在通用交付物清单中，不附带任何'如做带服务端'的前提条件。"

**处理决策**：接受智能体的纠正，确认 WebUI 是必做的。调整架构为三层（Harness 内核 + WebUI + 基础设施）。

### 迭代 2：凭据安全的对象

**对话节选**：

> 用户："但是我做这个项目也不需要什么key啊，这只是一个harness，所以只要针对用户就行了吧"
>
> 智能体："你说得完全对。harness 是一个产品，你自己开发时不需要任何 key。需要 key 的是 harness 的使用者——他们安装 harness 后配置自己的 LLM API key。"

**处理决策**：将凭据安全设计从"开发者+用户双层"修正为"纯用户侧"。威胁模型只针对用户的 key。

### 迭代 3：上下文压缩策略

**对话节选**：

> 智能体（在 SPEC 未决问题中）："上下文压缩策略：简单截断 vs LLM 摘要？→ 先实现简单截断（保留最近 N 条），摘要作为可选增强。"
>
> 用户："上下文压缩策略我不想做简单截断"
>
> 智能体：更新为"采用 LLM 摘要压缩。当 token 数接近窗口上限时，保留 system prompt + 最近 N 条消息，将较早的消息交由 LLM 生成结构化摘要，替换原始消息。"

**处理决策**：推翻智能体的"先简单后复杂"建议，直接采用 LLM 摘要压缩。

---

## 三、AI 提出而我采纳的建议

| 建议 | 来源 | 采纳理由 |
|------|------|---------|
| TypeScript/Node.js 作为技术栈 | 智能体推荐 | 异步 I/O、WebUI 生态、测试框架均最合适 |
| 治理/护栏作为重点维度 | 智能体推荐 | 代码密集，最契合"机制必须是代码"要求 |
| 单包模块化架构（方案 A） | 智能体推荐 | 个人项目深度优先，最简单直接 |
| 纳入 Tracer（可观测性） | 智能体对比参考实现后提出 | WebUI 实时监控本来就需要 |
| 纳入 Context compaction | 智能体对比参考实现后提出 | 长对话必须处理窗口溢出 |
| OS 钥匙串 + .env 回退 | 智能体推荐 | 最安全且跨平台 |
| Open Design Linear 设计系统 | 智能体推荐 | 简洁、开发者风格 |
| 可折叠监控面板 | 用户提出，智能体采纳 | 不干扰对话体验 |

## 四、我推翻或修正的 AI 建议

| AI 建议 | 我的处理 | 理由 |
|---------|---------|------|
| 凭据安全同时针对开发者和用户 | 修正为纯用户侧 | harness 是产品，开发者自己不需要 key |
| 上下文压缩先做简单截断 | 推翻，直接做 LLM 摘要 | 简单截断会丢失关键上下文，不值得作为第一步 |
| SPEC 中 LLM 供应商参考用户配置 | 修正为用户自配 | harness 是工具，用户自己接自己的 LLM |
| WebUI 画面占比（监控面板过大） | 修正为可折叠侧边栏 | 监控面板不能占太大，要可折叠 |

---

## 五、反思：Brainstorming 技能的优缺点

### 做得好的地方

1. **逐个提问、一次一个**：避免了信息过载，每个问题都能深入思考。多选题格式让回答更高效。
2. **回到原始文档核对**：在 WebUI 必要性上，智能体回到 §五 逐条核对，发现了我遗漏的硬性要求。这比人的"先入为主"更可靠。
3. **分节呈现设计、逐节确认**：每节确认后才继续，确保设计逐步收敛，不会在错误基础上累积。
4. **提出 2-3 种方案及权衡**：架构方案 A/B/C 的对比让我能快速做出选择，而不是从零开始思考。
5. **SPEC 自审**：写完 SPEC 后自动检查占位符、一致性、范围、歧义，发现了一个格式问题。

### 让我不满的地方

1. **对需求文档的理解不够主动**：WebUI 的必要性是用户质疑后才回去核对的，不是智能体在 brainstorming 开始时就主动识别的。如果用户没有质疑，可能会在实现阶段才发现这个遗漏。
2. **凭据安全的概念混淆**：智能体最初把开发者侧纪律和用户侧功能混在一起，是用户指出后才修正。一个更好的 brainstorming 应该在提问阶段就区分"这个功能是给谁的"。
3. **上下文压缩策略的默认值过于保守**："先简单截断"是一个安全的默认，但在 coding agent 场景下，上下文丢失的代价很高。智能体应该根据领域特征给出更合适的默认。
4. **缺少对 scope 的主动质疑**：智能体没有主动提出"这个项目 20 个 task 是否太大"或"是否应该分阶段实现"这类 scope 问题。用户需要自己判断 scope 是否合理。
5. **Visual companion 未使用**：brainstorming 技能提到可选的可视化伴侣，但在整个过程中从未真正使用。对于 WebUI 布局设计，可视化可能比文本描述更有效。

---

## 六、冷启动验证（§4.5）

> **验证目的**：用一个**与主开发 agent 不同**的 agent，在**不提供对话历史**的前提下，仅凭 `SPEC.md` + `PLAN.md` 尝试实现 1-2 个 task。观察它在哪些地方暂停提问，暴露哪些 spec 缺陷。

### 6.1 验证环境

| 项 | 值 |
|---|---|
| **验证日期** | 2026-07-13 |
| **Agent 身份** | 主会话中的新对话 agent（非 subagent），加载 superpowers brainstorming + TDD skills |
| **Agent 可访问的上下文** | `SPEC.md`（完整 11 节）+ `PLAN.md`（完整 20 个 task）+ `package.json`（依赖已安装） |
| **Agent 不可访问的上下文** | Agent Log、Superpowers 对话历史、Brainstorming 过程文档 |
| **选择 task** | Task 5（Policy Engine）、Task 8（Feedback System）——用户建议这两个任务匹配逻辑和输出解析可能存在歧义 |
| **Agent 前置条件** | Task 1（Scaffolding）和 Task 2（LLM Abstraction）已完成，`src/core/types.ts` 和 `src/core/llm.ts` 已存在 |

### 6.2 观察结果

#### 6.2.1 Agent 在哪里暂停并做出决策

| # | 节点 | Agent 行为 | 性质 |
|---|------|-----------|------|
| O1 | Task 5 — `globMatch` 首跑 GREEN 失败 | PLAN 给的代码 `** → .*` 无法匹配根目录 `.env`（`.replace(/\*\*/g, ".*")` 先跑，后续 `*` 替换破坏了已生成的 `.*`，且未 escape `.`）。Agent **自行 debug**，用占位符方案（先替换为 NUL placeholder、再 escape regex chars、再替换为正则等价物）修复，共试错 2 轮 | **Spec/Plan Defect**：PLAN 代码有 2 个 bug，测试本身暴露了它 |
| O2 | Task 8 — `SensorConfig` 字段范围 | PLAN 只定义了 `SensorConfig = { test: string }`。Agent **自行添加** `lint?: string; typecheck?: string`（可选字段）以对齐 `Config.sensors` 的完整类型定义 | **Agent 改进**（SPEC 要求三传感器，PLAN 简化为一传感器，agent 按 SPEC 做了对齐） |
| O3 | Task 5 — `path_boundary` pattern `"."` 语义 | Agent 直接用 `resolve(policy.pattern)` 解析 `.`，依赖 CWD。未质疑 | **潜在缺陷**：Agent 遵循了 PLAN 的写法，但 `.` 是 CWD-relative，跨目录运行测试时行为不可靠 |
| O4 | Task 8 — `classifyFailure` 运算符优先级 | `lower.includes("fail") \|\| lower.includes("assertion") \|\| lower.includes("expected") && lower.includes("to be")` — 实际解析为 `fail \|\| assertion \|\| (expected && to_be)`，因为 `&&` 优先级高于 `\|\|`。逻辑**碰巧正确**但可读性差。Agent 原样照搬 PLAN | **Spec 未明确**：优先级是否有意为之？PLAN 未加括号说明意图 |

#### 6.2.2 Agent 做出了哪些与 SPEC/PLAN **原意不一致**的解读

| # | PLAN/SPEC 原意 | Agent 实际解读 | 判定 |
|---|---------------|---------------|------|
| D1 | `globMatch` 用简单 `.replace` 链 | Agent 重写为占位符方案（6 行变 12 行） | **PLAN 写错**：简单 replace 链无法正确处理嵌套通配 + 正则特殊字符 |
| D2 | `SensorConfig` 只要 `{ test: string }` | Agent 加了 `lint/typecheck` 可选字段 | **PLAN 过于最小**：不符合 SPEC §3.5 的完整配置 |
| D3 | `shellExec` 在 PLAN Task 4 Step 7 中有 `(args, opts?: { timeout?: number })` 签名 | 未触达（本 session 未实现 Task 4），但若实现会撞类型不兼容 | **PLAN Defect**：`Tool` 类型只接受 `(args: ToolArgs) => Promise<ToolResult>`，`shellExec` 签名多出 `opts` 参数 |
| D4 | `path_boundary` pattern `"."` 直接 `resolve` | Agent 照做 | **PLAN 不精确**：没有说明 `"."` 应相对于项目根目录，而非 CWD |

#### 6.2.3 产出质量评估

| 维度 | 评价 | 详情 |
|------|------|------|
| **测试是否通过** | ✅ PASS | 18/18 tests pass across 5 files, 包含 Task 1-2 的存量测试 |
| **TDD 严格执行度** | ✅ 严格遵守 | 每个测试都经历了 RED→GREEN 循环，无跳过 RED 步骤 |
| **`globMatch` 实现** | 优于 PLAN | 占位符方案正确性更高，能正确匹配 `**/.env` 对根目录 `.env` |
| **`SensorConfig` 实现** | 优于 PLAN | 字段与 SPEC §3.5 的 `Config.sensors` 对齐 |
| **代码直接可用性** | 可用，但需小幅修改 | `path_boundary` 的 CWD 依赖是 latent bug；`shellExec` 类型不兼容需改 PLAN |
| **未实现** | 未实现：`fromYaml` 的加载测试、`classifyFailure` 跨多传感器合并、`extractFailures` JUnit/TAP 解析 | 这些功能 SPEC 声明但 PLAN 未覆盖 |

### 6.3 暴露的 SPEC 缺陷

| # | SPEC 章节 | 缺陷 | 严重度 | 修复方案 |
|---|----------|------|--------|---------|
| S1 | §3.4.1 path_pattern | "glob 匹配文件路径"未指定 glob 方言：POSIX？micromatch？minimatch？`**/` 是否匹配零目录？ | Medium | 明确为 POSIX glob，`**/` 匹配零个或多个目录层级 |
| S2 | §3.4.1 path_boundary | pattern 的解析基准不明确（CWD？项目根？绝对路径？） | Medium | 明确 pattern 是相对于 `PROJECT_DIR` 的路径 |
| S3 | §3.4.1 策略作用域 | 三种 policy type（`command_pattern`/`path_pattern`/`path_boundary`）对所有 tool 类型一视同仁，导致 `file_read` 动作被 `command_pattern` 规则误匹配（虽然因无 `command` 字段不会命中） | Low | 可选地为 `Policy` 加 `appliesTo?: string[]` 字段限定工具类型 |
| S4 | §3.5 分类优先级 | 4 种分类无优先级规范；`"type error in test"` 同时含 type + test 关键字 | Medium | 明确优先级：`syntax_error > type_error > lint_violation > test_failure > unknown` |
| S5 | §3.5 输出格式 | "支持常见格式（JUnit、tap、文本）"声明了但 PLAN 只实现简单文本解析，JUnit XML 和 TAP 协议未实现 | Medium | 删除 JUnit/TAP 声明，或 PLAN Task 8 中明确为"文本子集" |
| S6 | §3.5 多传感器合并 | `Config.sensors` 含 `test/lint/typecheck` 三项，但 PLAN 的 `validate()` 只接收单个 `ToolResult`，未定义如何运行和合并多个传感器 | Medium | 明确：单个 `validate(result)` 处理一个传感器结果；多传感器由 Agent Loop 调度多次调用 |

### 6.4 暴露的 PLAN 缺陷

| # | PLAN 位置 | 缺陷 | 修复 |
|---|----------|------|------|
| P1 | Task 5 Step 3 `globMatch` | 代码有 2 bug：① `**/` 语义缺失（只转 `**` 导致 `**/.env` 变成 `..*/..env` 而不是 `(.*/)?.env`）；② 未 escape `.` 等正则特殊字符 | 替换为占位符方案代码（见 6.5 修订 diff） |
| P2 | Task 4 Step 7 `shellExec` 签名 | `(args, opts?: { timeout?: number })` 不兼容 `Tool` 接口类型 | 将 `opts` 合并进 `ToolArgs` 或改用包装函数 |
| P3 | Task 8 Step 3 `classifyFailure` | `lower.includes("expected") && lower.includes("to be")` 依赖隐式运算符优先级，可读性差 | 加括号明确：`(lower.includes("expected") && lower.includes("to be"))` |
| P4 | Task 8 Step 7 `SensorConfig` | `{ test: string }` 不含 `lint`/`typecheck`，与 `Config.sensors` 类型不匹配 | 扩展为 `{ test: string; lint?: string; typecheck?: string }` |
| P5 | Task 5 Step 1 `path_boundary` 测试 | "project-only" 规则用 `pattern: "."`，但 `resolve(".")` 依赖 CWD；测试在不同目录运行可能失败 | 使用绝对路径或在 test setup 中 mock `process.cwd()` |

### 6.5 修订的 SPEC.md / PLAN.md diff 摘要

> 完整修订见文件 `SPEC.md` 和 `PLAN.md`（本 session 已应用）。

**SPEC.md 修订：**

```diff
§3.4.1 — 补充 glob 方言及 path_boundary 语义：

- | **行为** | 逐条匹配策略规则（命令模式、路径边界、路径模式），返回首个匹配的决策 |
+ | **行为** | 逐条匹配策略规则（命令模式、路径边界、路径模式），返回首个匹配的决策。
+ | **glob 方言** | path_pattern 使用 POSIX glob 语义：`**` 匹配零个或多个路径段，`*` 匹配单层路径段（不含 `/`），`?` 匹配单个字符。pattern 中的 `.` 等正则特殊字符应作为字面量处理。
+ | **path_boundary 基准** | pattern 为相对于 PROJECT_DIR 的路径（而非 CWD），用于判定 action 的 `path` 是否越出边界。

§3.5 — 澄清分类优先级及传感器调度：

- | **行为** | 运行配置的传感器命令（test/lint/typecheck）→ 解析输出 → 客观判定 → 分类失败 |
+ | **行为** | 接收单个传感器的 ToolResult → 客观判定 → 解析失败 → 分类为以下之一：`syntax_error`、`type_error`、`lint_violation`、`test_failure`、`unknown`（按优先级顺序判定，首个命中即返回）。
+ | **调度** | 多传感器（test/lint/typecheck）由 Agent Loop 负责调度，分别调用 validate()，各自产生独立的 FeedbackReport。
+ | **输出格式** | 解析纯文本格式的测试/lint/类型检查输出（JUnit XML 和 TAP 协议为未来扩展，不在初版范围）。

§6.1 Policy 类型 — 新增工具作用域说明：

+ | `appliesTo` | 可选字段，`string[]`，限定策略只作用于指定工具（如 `["shell_exec"]`）。未定义时作用于所有工具。 |
```

**PLAN.md 修订：**

```diff
P1 — Task 5 Step 3 globMatch 修复：

- private globMatch(pattern: string, path: string): boolean {
-   const regexStr = pattern
-     .replace(/\*\*/g, ".*")
-     .replace(/\*/g, "[^/]*")
-     .replace(/\?/g, ".")
-   return new RegExp(`^${regexStr}$`).test(path)
- }
+ private globMatch(pattern: string, path: string): boolean {
+   let regexStr = pattern
+     .replace(/\*\*\//g, "\x00GLOBSTAR_SLASH\x00")
+     .replace(/\*\*/g, "\x00GLOBSTAR\x00")
+     .replace(/\*/g, "\x00STAR\x00")
+     .replace(/\?/g, "\x00QUESTION\x00")
+   regexStr = regexStr.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
+   regexStr = regexStr
+     .replace(/\x00GLOBSTAR_SLASH\x00/g, "(.*/)?")
+     .replace(/\x00GLOBSTAR\x00/g, ".*")
+     .replace(/\x00STAR\x00/g, "[^/]*")
+     .replace(/\x00QUESTION\x00/g, ".")
+   return new RegExp(`^${regexStr}$`).test(path)
+ }

P2 — Task 4 Step 7 shellExec 签名修复：

- export const shellExec: Tool = async (args, opts?: { timeout?: number }) => {
+ export const shellExec: Tool = async (args) => {
    ...
-   const timeout = opts?.timeout ?? 30000
+   const timeout = (args as any).timeoutMs ?? 30000

P3 — Task 8 Step 3 classifyFailure 运算符优先级：

- if (lower.includes("fail") || lower.includes("assertion") || lower.includes("expected") && lower.includes("to be")) {
+ if (lower.includes("fail") || lower.includes("assertion") || (lower.includes("expected") && lower.includes("to be"))) {

P4 — Task 8 Step 7 SensorConfig：

- interface SensorConfig {
-   test: string
- }
+ interface SensorConfig {
+   test: string
+   lint?: string
+   typecheck?: string
+ }

P5 — Task 5 Step 5 path_boundary 策略 pattern（改为显式路径说明）：

+ // 注：pattern "." 相对于 PROJECT_DIR 解析，而非 CWD。
+ // Agent Loop 在初始化 PolicyEngine 时需注入 PROJECT_DIR 作为 resolve 基准。
```

### 6.6 结论与建议

**SPEC 缺陷总结**：
1. **glob 方言未指定（S1）**是最大缺陷：导致 PLAN 中 `globMatch` 代码是错的，agent 必须自行 debug。修复代价不高，但浪费了约 50% 的 Task 5 实现时间。
2. **path_boundary 基准不明确（S2）**是 latent bug：当前测试通过只是因为恰好在 CWD = project root 时运行。一旦集成其他模块（如 Web Server 的工作目录），行为会断裂。
3. **分类优先级（S4）**和**传感器调度（S6）**是中等缺陷：PLAN 的实现是模糊正确的，但未来维护者会因缺乏规范而困惑。

**PLAN 缺陷总结**：
1. **`globMatch` 代码错误（P1）** 是唯一的 critical bug：如果 agent 完全照搬而不测，会得到错的实现。
2. **`shellExec` 签名不兼容 `Tool` 类型（P2）** 是另一个类型级 bug，会在 Task 4 实现时暴露（当前尚未实现 Task 4）。

**整体评价**：冷启动 agent 成功实现了 Task 5 和 Task 8（18 tests pass），没有中途暂停询问用户。但它被迫 **偏离 PLAN 代码进行了多处修正** ——这些修正是正确的（修复了 PLAN 的 bug），但说明 PLAN 的代码不够"可靠"到让一个独立 agent 直接照搬执行。这是 PLAN 质量的主要短板。

**改进建议**：
- PLAN 中每段代码在撰写前都应先跑一遍测试（或让 agent 在 writing-plans 阶段做 TDD dry-run），而非仅凭经验手写。
- glob 和 path 匹配这类领域特定的函数，应在 SPEC 中明确语义规范（dialect、escaping rules、resolve base），不能依赖 agent 自行 debug 修正。
