# Coding Agent Harness

> **语言要求**: 所有对话和交流必须使用中文。

## 架构

```
src/
  index.ts                 — 入口：环境变量 → keytar → .env 三级回退获取 API key
  web/
    server.ts              — Express + WebSocket 服务端 (PORT 环境变量，默认 3000)
    frontend/              — React+Vite SPA (根目录: src/web/frontend)
      App.tsx              — 多对话管理，pendingReply 用 ref 而非 state 避免竞态
      hooks/useWebSocket.ts — 3 秒自动重连，持久化到 sessionStorage
  core/
    loop.ts                — Harness.run(): LLM → 策略引擎 → HITL → 沙箱 → 反馈
    llm.ts                 — RealLLMProvider (OpenAI 兼容接口), MockLLMProvider (测试用)
    types.ts               — TraceEvent, AgentResult, Config, Policy 等类型
    governance/
      hitl.ts              — HitlStateMachine: 基于 Promise resolver 的审批模式
      policy.ts            — PolicyEngine: 命令/路径模式匹配
      sandbox.ts           — Sandbox: 带时间和内存限制的工具执行
    tracer.ts              — 事件缓冲区（上限 N），广播给所有 WebSocket 客户端
```

## 命令

| 命令 | 说明 |
|------|------|
| `npm test` | 运行所有 vitest 测试 |
| `npm run dev` | 通过 tsx 启动后端 |
| `npm run dev:web` | Vite 开发服务器（代理 /api + /ws 到 :3000） |
| `npm run build` | `tsc` — 编译 src + tests 到 dist |
| `npx vite build && npx tsc -p tsconfig.build.json` | 生产构建（前端 + 后端） |
| `npm start` (构建后) | `node dist/index.js` |

## 关键注意事项

- **两个 tsconfig**: `tsconfig.json` 包含 tests（开发用），`tsconfig.build.json` 设置 `rootDir: "src"` 并排除 tests。生产构建必须用 `-p tsconfig.build.json`。
- **构建顺序**: 必须先构建前端（`vite build`）再构建后端（`tsc`）。后端构建从 vite 输出复制 `dist/frontend`。
- **HITL 审批流程**: 服务端在 `HitlStateMachine` 中存储 promise resolver。前端调用 `POST /api/sessions/:id/approve`，走 HTTP 而非 WebSocket。
- **事件广播**: `Tracer` 通过回调广播事件。WebSocket 连接通过 URL query `?sessionId=xxx` 与会话关联，`done`/`error` 事件仅发给匹配的客户端（无 sessionId 的旧客户端作为兜底）。
- **LLM 引用共享**: 所有会话共享同一个 `deps.llm` 对象。`rebuildLLM()` 全局替换它，优先从 credentialStore 读取，回退到 `process.env.OPENAI_API_KEY`。配置变更前创建的会话仍使用旧引用，直到调用 `run()`（此时读取当前 `deps.llm`）。
- **沙箱工作目录**: 每个会话独享 `/tmp/harness-workspaces/session-<时间戳>/`，sandbox.ts 将相对路径 resolve 为 workspace 下的绝对路径后再传给工具函数。通过 `DELETE /api/sessions/:id` 可清理会话及其 workspace。
- **WebSocket 认证**: 服务端启动时生成随机 token（`GET /api/auth-token`），WS 连接需携带 `?token=xxx` 参数。
- **API key 回退**: `process.env.OPENAI_API_KEY` → keytar（OS 钥匙串）→ `.harness/.env` 文件。`rebuildLLM()` 先查 credentialStore，再回退到环境变量。
- **无 linter/formatter**: 项目没有 eslint、prettier 或 husky 配置。
- **端口**: `process.env.PORT ?? "3000"` — Render 会设置 PORT 环境变量。

## 测试

- Vitest 配置: `vitest.config.ts` — 测试文件在 `tests/**/*.test.ts`，node 环境
- 关键模式: 通过 `MockLLMProvider` mock LLM 响应，每个测试用临时目录，`beforeEach`/`afterEach` 清理
- 服务端测试在模块级别通过 `vi.mock` mock keytar
- 3 个 demo 测试使用 mock LLM（无需网络）：guardrail、feedback、HITL
- 运行单个测试: `npx vitest run tests/core/loop.test.ts`
