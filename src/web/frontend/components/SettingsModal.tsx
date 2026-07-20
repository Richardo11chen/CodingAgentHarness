import { useState, useEffect } from "react"

interface SettingsModalProps {
  onClose: () => void
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState("")
  const [hasKey, setHasKey] = useState(false)
  const [model, setModel] = useState("")
  const [baseURL, setBaseURL] = useState("")
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch("/api/credentials").then(r => r.json()).then(d => setHasKey(d.hasKey))
    fetch("/api/config").then(r => r.json()).then(d => {
      setModel(d.llm?.model ?? "")
      setBaseURL(d.llm?.baseURL ?? "")
    })
  }, [])

  const saveKey = async () => {
    if (apiKey) {
      await fetch("/api/credentials", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: apiKey }),
      })
      setHasKey(true)
      setApiKey("")
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  const deleteKey = async () => {
    await fetch("/api/credentials", { method: "DELETE" })
    setHasKey(false)
  }

  const saveConfig = async () => {
    await fetch("/api/config", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ llm: { model, baseURL } }),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
    }}>
      <div style={{
        background: "white", borderRadius: "12px", padding: "24px",
        width: "480px", maxHeight: "80vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ margin: 0 }}>设置</h2>
          <button onClick={onClose} style={{ border: "none", background: "none", fontSize: "20px", cursor: "pointer" }}>x</button>
        </div>

        <div style={{ marginBottom: "24px" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: "14px", color: "#666" }}>API Key</h3>
          <div style={{ marginBottom: "8px", fontSize: "13px", color: hasKey ? "#22c55e" : "#ef4444" }}>
            {hasKey ? "Key已配置" : "Key未配置"}
          </div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            <input
              type="password"
              placeholder="输入API Key..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={{ flex: 1, padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
            />
            <button onClick={saveKey} style={{ padding: "8px 16px", background: "#3b82f6", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>保存</button>
          </div>
          {hasKey && (
            <button onClick={deleteKey} style={{ padding: "4px 12px", fontSize: "12px", background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: "4px", cursor: "pointer" }}>删除Key</button>
          )}
        </div>

        <div style={{ marginBottom: "24px" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: "14px", color: "#666" }}>模型配置</h3>
          <label style={{ display: "block", marginBottom: "4px", fontSize: "13px" }}>模型名称</label>
          <input
            placeholder="如 glm-5.2, gpt-4o..."
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", marginBottom: "12px", boxSizing: "border-box" }}
          />
          <label style={{ display: "block", marginBottom: "4px", fontSize: "13px" }}>Base URL</label>
          <input
            placeholder="如 https://njusehub.info/v1"
            value={baseURL}
            onChange={(e) => setBaseURL(e.target.value)}
            style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", marginBottom: "12px", boxSizing: "border-box" }}
          />
          <button onClick={saveConfig} style={{ padding: "8px 16px", background: "#3b82f6", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
            保存配置
          </button>
        </div>

        {saved && (
          <div style={{ padding: "8px", background: "#dcfce7", color: "#16a34a", borderRadius: "4px", fontSize: "13px", textAlign: "center" }}>
            已保存
          </div>
        )}

        <div style={{ marginTop: "16px", padding: "12px", background: "#f3f4f6", borderRadius: "8px", fontSize: "12px", color: "#666" }}>
          <p style={{ margin: "0 0 4px" }}><b>说明：</b></p>
          <p style={{ margin: "0" }}>API Key 优先从环境变量读取，其次从钥匙串，最后从 .env 文件。修改模型配置后需重启服务生效。</p>
        </div>
      </div>
    </div>
  )
}
