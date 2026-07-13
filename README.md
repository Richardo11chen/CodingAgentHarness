#  Coding Agent Harness

## 部署

### 本地运行
```bash
docker build -t coding-agent-harness .
docker run -p 3000:3000 -v $(pwd)/workspace:/workspace coding-agent-harness
```
访问 http://localhost:3000

### 云部署 (Render)
1. 推送代码到 GitLab
2. 在 Render 创建新服务，连接仓库
3. 使用 render.yaml 配置
4. 部署后访问公网 URL

### Key 安全配置
首次访问 WebUI 时通过引导对话框录入 API Key，存入钥匙串。
