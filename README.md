# Coding Agent Harness

> Agent = LLM + Harness. 本项目实现了一个面向 coding 场景的 agent harness 内核——当 LLM 负责"决定下一步做什么"时，harness 负责组织上下文、分发工具、治理护栏、反馈闭环、记忆与配置。

## 项目简介

Coding Agent Harness 将一个只会产生下一步设想的 LLM，封装成一台能稳定、可靠工作的系统。harness 内核完全由 TypeScript 自行编码实现，不寄生于任何现成 agent 框架。

**重点维度**：治理/护栏（Policy Engine + HITL 状态机 + Sandbox），辅以反馈闭环（确定性校验器 + 失败分类 + 多轮自我修正）。

**核心机制**（移除真实 LLM 后仍可用 mock 单测验证）：
- **决策封装**：agent 主循环（组织上下文 → 调用 LLM → 解析动作 → 分发执行 → 回灌结果 → 停机判断）
- **动作/工具**：file_read / file_write / file_delete / shell_exec / run_test
- **治理护栏**：Policy Engine（危险命令拦截）+ HITL 状态机（人工审批）+ Sandbox（超时/内存限制）
- **反馈闭环**：传感器（test/lint/typecheck）→ 校验器 → 失败分类 → 回灌 LLM
- **上下文压缩**：LLM 摘要压缩（非简单截断）
- **记忆**：跨会话 MemoryStore（JSON 持久化）
- **配置**：声明式 YAML 配置（`.harness/config.yml` + `.harness/policies.yml`）

## 安装

### 前置要求
- Node.js 22+
- npm 10+

### 从源码安装
```bash
git clone https://github.com/Richardo11chen/CodingAgentHarness.git
cd CodingAgentHarness
npm ci
```

### 从 npm 安装
```bash
npm install -g coding-agent-harness
# 卸载
npm uninstall -g coding-agent-harness
```

### 从 Docker 安装
```bash
docker build -t coding-agent-harness .
```

## 运行

### 本地开发
```bash
# 启动 WebUI（默认 http://localhost:3000）
npm run dev

# 前端热更新开发
npm run dev:web
```

### npm 全局安装后运行（任意目录）
```bash
# 安装（在项目根目录执行一次）
npm install -g .

# 然后在任意目录启动，agent 以当前目录为工作区
cd /any/directory
coding-agent-harness

# 卸载
npm uninstall -g coding-agent-harness
```

### Docker 运行
```bash
docker build -t coding-agent-harness .
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=your-api-key \
  -v $(pwd):/workspace \
  coding-agent-harness
```
访问 http://localhost:3000

### 云部署 (Render)
1. Fork 仓库到自己的 GitHub
2. 在 Render 创建新 Web Service，连接仓库
3. 使用 `render.yaml` 配置（Docker runtime, free plan）
4. 设置环境变量 `OPENAI_API_KEY`
5. 部署后获取公网 URL

**已部署公网地址**：https://codingagentharness-t30h.onrender.com

## 分发命令

| 形态 | 命令 |
|------|------|
| npm 全局安装 | `npm install -g coding-agent-harness` |
| Docker 构建 | `docker build -t coding-agent-harness .` |
| Docker 运行 | `docker run -p 3000:3000 -e OPENAI_API_KEY=xxx coding-agent-harness` |
| 源码运行 | `npm ci && npm run dev` |

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
├── tests/                       # 72 个测试（全部 mock-LLM 驱动）
│   ├── core/                    # 内核单测
│   ├── governance/              # 治理单测
│   ├── feedback/                # 反馈单测
│   ├── tools/                   # 工具单测
│   ├── credentials/             # 凭据单测
│   ├── demo/                    # 机制演示（3 个场景）
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
- **Policy Engine**：基于 YAML 规则，在动作执行前拦截危险操作（如 `rm -rf /`、`git push --force`、`DROP TABLE`）
- **HITL 状态机**：对标记为 `ask` 的动作暂停执行，等待人工审批/拒绝
- **Sandbox**：工具执行受超时（30s）和内存（512MB）限制

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
# 运行全部 72 个测试（mock-LLM 驱动，无需网络）
npm test

# 机制演示
npx vitest run tests/demo/
```

### 机制演示（§A.6）
1. **治理护栏拦截**：`tests/demo/guardrail-demo.test.ts` — agent 尝试 `rm -rf /`，被 Policy Engine 拦截
2. **反馈闭环修正**：`tests/demo/feedback-demo.test.ts` — agent 写入错误代码，传感器反馈失败，agent 据此修正
3. **HITL 审批流程**：`tests/demo/hitl-demo.test.ts` — agent 请求审批，暂停等待人工确认后恢复

## 技术栈

- **语言**：TypeScript / Node.js 22+
- **后端**：Express + WebSocket (ws)
- **前端**：React 18 + Vite
- **测试**：Vitest（72 个确定性单测）
- **凭据**：keytar（OS 钥匙串）+ dotenv（.env 回退）
- **LLM**：任意 OpenAI-compatible API（用户自配）
- **分发**：Docker + npm
- **部署**：Render
- **CI**：GitLab CI（unit-test job）

## 已知限制

- Linux 环境下 keytar 需要 `libsecret` 库（Docker 中不可用，回退到 .env）
- 沙箱的内存限制通过 `--max-old-space-size` 实现，非 cgroup 级隔离
- 前端 MonitorPanel 通过 WebSocket 实时推送追踪事件，无断线重连
- LLM 供应商需兼容 OpenAI Chat Completions API 格式

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
