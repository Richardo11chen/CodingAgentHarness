# Coding Agent Harness

> Agent = LLM + Harness. 本项目实现了一个面向 coding 场景的 agent harness 内核——当 LLM 负责"决定下一步做什么"时，harness 负责组织上下文、分发工具、治理护栏、反馈闭环、记忆与配置。

## 项目简介

Coding Agent Harness 将一个只会产生下一步设想的 LLM，封装成一台能稳定、可靠工作的系统。harness 内核完全由 TypeScript 自行编码实现，不寄生于任何现成 agent 框架。

**重点维度**：治理/护栏（Policy Engine + HITL 状态机 + Sandbox），辅以反馈闭环（确定性校验器 + 失败分类 + 多轮自我修正）。

**核心机制**（移除真实 LLM 后仍可用 mock 单测验证）：
- **决策封装**：agent 主循环（组织上下文 → 调用 LLM → 解析动作 → 分发执行 → 回灌结果 → 停机判断）
- **动作/工具**：file_read / file_write / file_delete / shell_exec / run_test
- **治理护栏**：Policy Engine（危险命令拦截）+ HITL 状态机（人工审批）+ Sandbox（路径隔离 + 超时/内存限制）+ 连续拒绝自动停机
- **反馈闭环**：传感器（test/lint/typecheck）→ 校验器 → 失败分类 → 回灌 LLM
- **记忆**：跨会话 MemoryStore（JSON 持久化，按 session 隔离）
- **配置**：声明式 YAML 配置（`.harness/config.yml` + `.harness/policies.yml`）
- **多供应商**：支持 OpenAI 兼容 API + DeepSeek（thinking 模式 + 推理强度控制）

## 快速开始

### 1. 安装
```bash
git clone https://github.com/Richardo11chen/CodingAgentHarness.git
cd CodingAgentHarness
npm ci
npm run build
npm link
```

### 2. 启动（任意目录）

安装后，在**任意目录**直接输入 `coding-agent-harness` 启动：

```bash
cd /any/directory
coding-agent-harness
```
输出：
```
🤖 Coding Agent Harness
WebUI: http://localhost:3000
```
Ctrl+点击链接打开 WebUI。当前目录就是 agent 的工作区。

> **开发模式**：`npm run dev` 用 tsx 直接启动，无需每次 build。

### 3. 配置 API Key
启动后右下角点「设置」→ 输入 API Key → 保存。支持三种配置方式：
- **WebUI 设置面板**：输入后存入 `.harness/.env`（最方便）
- **环境变量**：`export OPENAI_API_KEY=sk-xxx`
- **OS 钥匙串**：keytar 自动检测（需 libsecret）

### 4. 选择供应商
支持三大预设供应商，点击即可切换：
- **OpenAI 兼容** (GLM / 任意 OpenAI-compatible API)
- **DeepSeek V4 Pro** (带 Thinking 模式)
- **DeepSeek V4 Flash** (快速模式)

每个供应商可独立配置 API Key，切换时自动使用对应 Key。

## Key 安全配置

harness 支持三种 API Key 来源（按优先级）：

1. **环境变量**（推荐用于 Docker/CI/云部署）：`OPENAI_API_KEY`
2. **OS 钥匙串**（推荐用于本地开发）：通过 WebUI 引导对话框录入，存入 macOS Keychain / Windows Credential Manager / Linux Secret Service（keytar）
3. **.env 文件回退**：`.harness/.env`（明文，权限 0600，仅当 keytar 不可用时使用）

**安全说明**：
- Key 绝不硬编码进源码、绝不提交进 Git
- 查看状态时不回显明文（仅返回 `hasKey: boolean`）
- `.env` 为明文存储，存在进程环境可见风险，仅作为 keytar 不可用时的回退方案
- Docker 部署时通过环境变量注入，不持久化到镜像层

## 目录结构

```
CodingAgentHarness/
├── src/
│   ├── core/                    # harness 内核（自行实现）
│   │   ├── loop.ts              # agent 主循环
│   │   ├── llm.ts               # LLM 抽象层（Mock + Real）
│   │   ├── types.ts             # 类型定义
│   │   ├── config.ts            # 配置加载
│   │   ├── compact.ts           # 上下文压缩（LLM 摘要）
│   │   ├── memory.ts            # 跨会话记忆
│   │   ├── tracer.ts            # 执行追踪
│   │   ├── tools/               # 工具实现
│   │   │   ├── file.ts          # 文件读写删
│   │   │   ├── shell.ts         # Shell 执行
│   │   │   └── test-runner.ts   # 测试运行
│   │   ├── governance/          # 治理护栏（重点维度）
│   │   │   ├── policy.ts        # Policy Engine
│   │   │   ├── hitl.ts          # HITL 状态机
│   │   │   └── sandbox.ts       # 沙箱
│   │   └── feedback/            # 反馈闭环
│   │       ├── validator.ts     # 传感器校验器
│   │       └── classifier.ts    # 失败分类
│   ├── credentials/             # 凭据管理
│   │   ├── keychain.ts          # OS 钥匙串（keytar）
│   │   └── env.ts               # .env 回退
│   ├── web/                     # WebUI
│   │   ├── server.ts            # Express + WebSocket 服务端
│   │   └── frontend/            # React + Vite 前端
│   │       ├── App.tsx
│   │       ├── components/      # ChatPanel, MonitorPanel, ApprovalModal
│   │       └── hooks/           # useWebSocket
│   └── index.ts                 # 入口
├── tests/                       # 133 个测试（全部 mock-LLM 驱动）
│   ├── core/                    # 内核单测
│   ├── governance/              # 治理单测
│   ├── feedback/                # 反馈单测
│   ├── tools/                   # 工具单测
│   ├── credentials/             # 凭据单测
│   ├── demo/                    # 机制演示（4 个场景）
│   └── web/                     # Web 服务单测
├── .harness/                    # 声明式配置
│   ├── config.yml               # harness 配置
│   └── policies.yml             # 治理策略规则
├── Dockerfile                   # 多阶段构建
├── render.yaml                  # Render 部署配置
├── .gitlab-ci.yml               # CI 配置（unit-test job）
├── SPEC.md                      # 设计规约
├── PLAN.md                      # 实现计划
├── SPEC_PROCESS.md              # brainstorming 过程文档
├── AGENT_LOG.md                 # 实现日志
└── REFLECTION.md                # 反思报告
```

## 安全边界说明

### 治理护栏
- **Policy Engine**：基于 YAML 规则，在动作执行前拦截危险操作
  - 禁止递归删除根目录（`rm -rf /`）
  - 禁止终止进程（`kill`/`pkill`）
  - 禁止提权/系统管理（`sudo`/`systemctl`/`reboot`）
  - 禁止查看系统和进程信息（`lsof`/`ss`/`netstat`/`ps`/`/proc/`）
  - 禁止请求本地服务（`curl`/`wget localhost`）
  - 禁止操作 `.env` 文件
  - 强制推送需人工确认（`git push --force`）
  - 删除数据库操作需确认
- **HITL 状态机**：对标记为 `ask` 的动作暂停执行，等待人工审批/拒绝，默认 5 分钟超时
- **连续拒绝停机**：连续 3 次被策略拒绝或人工否决后自动终止循环
- **Sandbox**：文件操作和 Shell 命令均隔离在 `/tmp/harness-workspaces/session-xxx/`，路径穿越自动拦截

### 凭据安全
- API Key 通过 OS 钥匙串或环境变量管理，绝不持久化到源码或日志
- `.env` 文件权限 0600，仅作为 keytar 不可用时的回退
- WebUI 凭据 API 不回显明文

### 沙箱边界
- 文件操作限制在项目目录内（path_boundary 规则）
- Shell 执行受超时和内存限制
- 危险命令（递归删除、强制推送、数据库删除）被拦截或需审批

## 测试

```bash
# 运行全部 133 个测试（mock-LLM 驱动，无需网络）
npm test

# 机制演示
npx vitest run tests/demo/
```

### 机制演示（§A.6）

harness 核心机制必须用 mock/stub LLM 驱动的确定性单元测试验证，不依赖网络与真实 LLM。以下三个演示在 MockLLMProvider 下确定性地复现关键行为：

**① 治理护栏拦截危险动作** — `tests/demo/guardrail-demo.test.ts`

MockLLMProvider 被编程为尝试执行 `rm -rf /`（递归删除根目录）。Policy Engine 的 `command_pattern` 规则匹配到该危险命令，返回 `decision: deny`，agent 主循环收到拦截信号并跳过该动作。测试断言 `tracer.getDenials()` 长度为 1，证明护栏在代码层面（非提示词）拦截了危险操作。

```bash
npx vitest run tests/demo/guardrail-demo.test.ts
```

**② 反馈闭环驱动修正** — `tests/demo/feedback-demo.test.ts`

MockLLMProvider 被编程为：第一步写入错误代码（`changedCode: true`），触发传感器运行测试命令。传感器返回失败结果（`exit code 1`），FeedbackValidator 解析输出并生成 `FeedbackReport`（`passed: false`），回灌到 agent 上下文。第二步 agent 据此反馈修正代码。测试断言 `tracer.getFeedbackReports()` 至少 1 条，且 agent 最终完成 3 步（写错→反馈→修正）。

```bash
npx vitest run tests/demo/feedback-demo.test.ts
```

**③ HITL 审批流程（重点维度）** — `tests/demo/hitl-demo.test.ts`

重点维度为治理/护栏。MockLLMProvider 被编程为执行一个标记为 `ask` 的危险动作（如 `git push --force`）。Policy Engine 返回 `decision: ask`，HITL 状态机暂停 agent 主循环，等待人工审批。测试模拟审批通过后，agent 恢复执行并完成。测试断言 agent 在审批前暂停（`hitl.getState() === pending`），审批后恢复（`hitl.getState() === approved`），最终返回结果。

```bash
npx vitest run tests/demo/hitl-demo.test.ts
```

**运行全部演示：**
```bash
npx vitest run tests/demo/
```

所有演示使用 MockLLMProvider，不依赖网络和真实 LLM，每次运行结果确定且可复现。

## 技术栈

- **语言**：TypeScript / Node.js 22+
- **后端**：Express + WebSocket (ws)
- **前端**：React 18 + Vite
- **测试**：Vitest（133 个确定性单测）
- **凭据**：keytar（OS 钥匙串）+ dotenv（.env 回退）
- **LLM**：OpenAI 兼容 API / DeepSeek（自动适配 thinking 模式）
- **分发**：Docker + npm
- **部署**：Render
- **CI**：GitLab CI（unit-test job）

## 分发

| 形态 | 命令 |
|------|------|
| npm 安装 | `npm install -g coding-agent-harness` |
| Docker | `docker build -t coding-agent-harness .` |
| Docker 运行 | `docker run -p 3000:3000 -e OPENAI_API_KEY=xxx coding-agent-harness` |
| 源码 | `npm ci && npm run dev` |
| Render | 使用 `render.yaml`，设置 `OPENAI_API_KEY` 环境变量 |

## 他人使用须知

1. **API Key 必须自配**：项目不内置任何 API Key，需在 WebUI 设置中自行录入
2. **支持的 LLM**：任意 OpenAI-compatible API（如 GLM、DeepSeek、OpenAI 等），在设置面板中自由切换供应商和模型
3. **DeepSeek Thinking 模式**：需在设置中开启，支持 High/Max 推理强度
4. **工作区隔离**：agent 所有操作限制在 `/tmp/harness-workspaces/` 临时目录，不影响宿主机文件
5. **默认配置**：`.harness/config.yml` 预设了 GLM 和 DeepSeek，可直接使用或自行修改
6. **端口**：默认 3000，可通过 `PORT` 环境变量修改

## 已知限制

- Linux 环境下 keytar 需要 `libsecret` 库（Docker 中不可用，回退到 .env）
- 同一时间仅支持一个会话运行（并发会被 409 拦截）
- 工作区隔离在 `/tmp/harness-workspaces/`，服务重启后丢失
- Thinking 模式下 DeepSeek 要求 `reasoning_content` 必须回传，代码已处理
- WebSocket 默认无认证，可搭配反向代理实现

## 第三方依赖与许可证

本项目使用以下开源第三方库：

| 库 | 用途 | 许可证 |
|----|------|--------|
| [express](https://github.com/expressjs/express) | Web 服务器 | MIT |
| [ws](https://github.com/websockets/ws) | WebSocket | MIT |
| [keytar](https://github.com/atom/node-keytar) | OS 钥匙串 | MIT |
| [dotenv](https://github.com/motdotla/dotenv) | .env 加载 | BSD-2-Clause |
| [yaml](https://github.com/eemeli/yaml) | YAML 解析 | ISC |
| [typescript](https://github.com/microsoft/TypeScript) | 编译器 | Apache-2.0 |
| [vitest](https://github.com/vitest-dev/vitest) | 测试框架 | MIT |
| [tsx](https://github.com/privatenumber/tsx) | TS 执行器 | MIT |
| [vite](https://github.com/vitejs/vite) | 前端构建 | MIT |
| [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react) | React 插件 | MIT |
| [react](https://github.com/facebook/react) | 前端框架 | MIT |
| [react-dom](https://github.com/facebook/react) | React DOM | MIT |

所有依赖均为宽松许可证（MIT / BSD / ISC / Apache），可安全使用和分发。
