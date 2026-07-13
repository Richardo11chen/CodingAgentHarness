# REFLECTION.md — 反思报告

> 本反思报告由学生本人撰写，使用 AI 辅助润色。

## 一、哪些 Superpowers 技能发挥了最大作用，哪些"形式大于实质"？

**发挥最大作用的技能**：

1. **brainstorming** — 这是整个项目价值密度最高的环节。它的逐个提问方式（技术栈→重点维度→WebUI→凭据→LLM→领域设计）有效避免了信息过载，让我在每一步都做出深思熟虑的决策。更重要的是，智能体在 brainstorming 中主动回到需求文档逐条核对，发现了 WebUI 是硬性要求（§五 item 9）——这个修正发生在我已经误以为"CLI 工具不需要 WebUI"之后。如果没有 brainstorming 的追问，我会在实现后期才发现这个遗漏，代价远大于现在。

2. **writing-plans** — 将设计分解为 20 个 task，每个含 TDD 步骤和完整代码。这个环节的价值不在于"计划本身完美"，而在于它迫使我在写代码之前就把每个模块的接口、测试用例、实现思路想清楚。冷启动验证证明了这一点：PLAN 中的 `globMatch` 代码有 bug，但如果没有 writing-plans，这个 bug 会直接出现在实现代码中，而不是在"计划评审"阶段就被发现。

3. **finishing-a-development-branch** — 它在合并前强制验证测试、检测环境、呈现结构化选项。这个技能的价值在于它把"完成工作"这个模糊的动作分解成了可检查的步骤，防止了"代码写完了但忘了验证"的常见失误。

**形式大于实质的技能**：

- **using-git-worktrees** — 在我的项目中没有实际使用 worktree。项目是单人开发，20 个 task 是串行依赖，没有可并行的独立模块。在多人或可并行场景下它有价值，但在我的场景下只是增加了流程开销。

- **executing-plans** — 与 subagent-driven-development 有较大重叠。我直接用了后者的"每 task 派一个新鲜 subagent"模式，executing-plans 的 review checkpoint 已内嵌在 subagent 流程中。

## 二、TDD 强制在 AI 协作下是阻碍还是放大器？

**TDD 是放大器**。

在 AI 协作场景下，TDD 的价值被放大了：AI 生成的代码经常"看起来对但实际有 bug"。TDD 的"先红再绿"强制了"测试先于实现失败"，意味着每个测试验证了真实需求，而不是事后为已有代码编写的"自证测试"。

具体案例：在 Task 5（Policy Engine）的冷启动验证中，agent 实现了 `globMatch` 函数。如果先写实现再补测试，agent 可能会写一个恰好通过自己实现的测试（比如只测了简单 case）。但 TDD 强制先写测试（包括 `**/.env` 这种 edge case），测试先红了，然后 agent 写实现使其变绿——这个过程中 agent 发现自己的第一版 `globMatch` 是错的（`**/` 语义缺失），不得不修正。这就是 TDD 的价值：它让 bug 在"写实现"阶段就暴露，而不是在"集成"或"部署"阶段。

**前提条件**：TDD 要发挥价值，测试用例本身必须有质量。如果测试只覆盖 happy path，TDD 就退化为"形式化的红绿循环"。在冷启动验证中，我发现 PLAN 中的测试用例确实覆盖了 edge case（如 `**/.env` 匹配零目录），这说明 writing-plans 阶段的测试设计是到位的。

## 三、subagent-driven 工作流让智能体能自主运行多久而不偏离主题？

**在我的项目中，单个 subagent 可以自主完成一个 task（约 5-15 分钟）而不偏离主题。**

20 个 task 全部由 subagent 实现，每个 task 的模式是：implementer subagent 拿到 PLAN 中的 task 描述（含目标、涉及文件、TDD 步骤、完整代码）→ 自主实现 → review package → reviewer subagent 评审。这个流程在单个 task 粒度上是可靠的——subagent 不会偏离主题，因为 PLAN 已经把"做什么"和"怎么做"都写清楚了。

但如果让一个 subagent 连续做多个 task，偏离风险会急剧上升。原因是 subagent 会积累上下文——前一个 task 的实现细节会影响它对后一个 task 的理解。我在项目中采用了"每 task 一个新鲜 subagent"的策略，正是为了避免这种上下文污染。

**最优的 task 颗粒度**：2-5 分钟的实现量，涉及 1-3 个文件，有明确的输入输出接口。我的 20 个 task 基本符合这个标准。太大的 task（如"实现整个治理模块"）会让 subagent 失焦；太小的 task（如"写一个函数"）会增加流程开销。

## 四、SPEC / PLAN 质量如何影响实现质量？

**冷启动验证提供了最直接的证据**。

在冷启动验证中，我用一个不同的 agent（不同 session、不导入对话历史）仅凭 SPEC + PLAN 实现 Task 5（Policy Engine）和 Task 8（Feedback System）。结果：

- **6 个 SPEC 缺陷**被发现，包括 glob 方言未指定（S1）、path_boundary 基准不明确（S2）、分类优先级未定义（S4）等。
- **5 个 PLAN 缺陷**被发现，其中最严重的是 `globMatch` 代码有 2 个 bug（`**/` 语义缺失 + 未 escape 正则特殊字符）。

**具体案例：glob 方言导致 subagent 偏离**

SPEC 中写了"path_pattern 使用 glob 匹配文件路径"，但没有指定 glob 方言。PLAN 中的 `globMatch` 代码用了 `**` → `.*` 的简单替换，但这不是标准 POSIX glob 语义。冷启动 agent 在实现时发现 `**/.env` 应该匹配零个或多个目录层级（即 `.env`、`a/.env`、`a/b/.env` 都应匹配），但 PLAN 的代码只匹配 `something/.env`（至少一层目录）。

这个案例说明：**SPEC 中一个看似简单的"使用 glob 匹配"描述，如果缺乏方言规范，会导致 PLAN 中的代码是错的，进而导致 subagent 实现偏离预期**。冷启动 agent 被迫自行 debug 修正，浪费了约 50% 的 Task 5 实现时间。

**改进措施**：冷启动验证后，我在 SPEC 中明确了"POSIX glob 语义，`**` 匹配零个或多个路径段"，并在 PLAN 中修正了 `globMatch` 代码。这证明了冷启动验证的价值——它是最接近"同侪评审"的内部机制，能暴露作者与主 agent 之间的隐性共识。

## 五、最有效的 prompt / context 策略

**最有效策略：在 PLAN 中为每个 task 提供完整代码 + TDD 步骤**。

这不是传统 prompt engineering，而是 context engineering——给 subagent 足够上下文，让它不需要猜测：每个 task 包含可直接复制的 TypeScript 代码、TDD 步骤（先写哪个测试、为什么红、再写什么实现）、依赖标注。这消除了 subagent 的"创造性发挥"空间。

有效的核心原因：subagent 上下文窗口有限且无对话历史。如果 PLAN 只写"实现一个 Policy Engine"，subagent 会自行设计接口，可能与前一个 task 不兼容。提供完整代码消除了这种不确定性。

## 六、凭据与分发这两条工程要求，迫使你想清楚了什么？

**凭据安全迫使我想清楚"开发者侧"与"用户侧"的区别**。

在 brainstorming 阶段，我最初把凭据安全理解为"开发者不硬编码 key"——这是一个开发纪律，不是产品功能。智能体的追问让我意识到：harness 是一个产品，需要 key 的是 harness 的使用者，不是开发者。这个区分直接影响了设计——凭据管理变成了一个纯用户侧功能模块（KeychainStore + EnvStore），而不是开发者的自查清单。

**分发迫使我想清楚"别人如何在一台全新机器上从零运行"**。这不仅仅是写 Dockerfile——key 在目标机器上怎么配置？Docker 容器里 keytar 不可用怎么办？.env 文件权限是什么？这些问题在"本地能跑"时不会暴露，但在"别人从零运行"时会全部浮现。Docker 部署时 keytar 不可用，所以我设计了三级回退：环境变量 → keytar → .env 文件。这个设计是在思考"Docker 里怎么配置 key"时才浮现的。

## 七、如果重做会改变什么？

1. **更早做冷启动验证**。冷启动验证发现了 11 个缺陷。如果在 brainstorming 每个设计节后都做一次"冷启动试读"，缺陷会更早暴露，修正代价更低。

2. **PLAN 中的代码应先跑测试**。冷启动发现 `globMatch` 有 bug——如果 writing-plans 阶段就跑了测试，bug 会在计划阶段被修复。

3. **前端应该用 Open Design**。需求文档强烈推荐，但我没有使用。重做会先调研其设计系统再决定方案。

## 八、对 Superpowers 方法论的批判

**假设一："流程脚手架能守住纪律"** — 基本成立。TDD、评审、计划确实被强制执行了。但技能无法强制"测试用例的质量"——TDD 要求"先红再绿"，但如果测试只覆盖 happy path，红绿循环就是形式化的。测试是否有意义需要人判断。

**假设二："subagent 能自主完成单一 task"** — 在 task 颗粒度合适时成立（2-5 分钟、1-3 文件），但冷启动验证中 agent 被迫偏离 PLAN 代码修正 bug，说明 subagent 的自主性依赖 PLAN 质量。

**假设三："brainstorming 能消除隐性共识"** — 部分成立。逐个提问消除了大部分共识（如 WebUI 必要性），但冷启动暴露了 6 个 SPEC 缺陷——这些缺陷说明，主 agent 和用户之间的共识是"在对话中形成的"，不一定全写进了 SPEC。冷启动验证是弥补这个 gap 的必要机制。

**总体判断**：Superpowers 的效果与使用者的判断力正相关。技能把"需要纪律才能做对的事"变成了流程的一部分，释放注意力去关注"需要判断力才能做对的事"。**当 AI 能完成大部分编码工作时，工程师的真正价值在于规约质量判断、过程证据审查、以及对"AI 做对了吗"的批判性验证**。Superpowers 守住了纪律，但判断力不可外包。
