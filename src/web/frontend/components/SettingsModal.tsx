import { useState, useEffect } from "react"
import { theme } from "../theme"

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
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
    }}>
      <div style={{
        background: theme.bg.surface, borderRadius: theme.radius.panel, padding: "28px",
        width: "480px", maxHeight: "80vh", overflowY: "auto",
        border: `1px solid ${theme.border.standard}`,
        boxShadow: "rgba(0,0,0,0.4) 0px 8px 24px",
        fontFamily: theme.font.family, fontFeatureSettings: theme.font.features,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ margin: 0, color: theme.text.primary, fontSize: "18px", fontWeight: 590 }}>设置</h2>
          <button onClick={onClose} style={{
            border: "none", background: "transparent", color: theme.text.tertiary,
            fontSize: "18px", cursor: "pointer", padding: "4px",
          }}>x</button>
        </div>

        <div style={{ marginBottom: "28px" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: "13px", color: theme.text.tertiary, fontWeight: 510 }}>API Key</h3>
          <div style={{ marginBottom: "10px", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{
              width: "8px", height: "8px", borderRadius: "50%",
              background: hasKey ? theme.status.green : theme.status.red,
            }} />
            <span style={{ color: hasKey ? theme.status.green : theme.status.red }}>
              {hasKey ? "已配置" : "未配置"}
            </span>
          </div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            <input
              type="password"
              placeholder="输入 API Key..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={{
                flex: 1, padding: "8px 14px", borderRadius: theme.radius.standard,
                border: `1px solid ${theme.border.standard}`, background: theme.bg.translucent,
                color: theme.text.primary, fontSize: "14px", outline: "none",
                fontFamily: theme.font.family,
              }}
            />
            <button onClick={saveKey} style={{
              padding: "8px 20px", borderRadius: theme.radius.standard,
              background: theme.brand.indigo, color: "#fff", border: "none",
              fontSize: "14px", fontWeight: 510, cursor: "pointer",
            }}>保存</button>
          </div>
          {hasKey && (
            <button onClick={deleteKey} style={{
              padding: "4px 12px", fontSize: "12px", background: "transparent",
              color: theme.status.red, border: `1px solid ${theme.border.standard}`,
              borderRadius: theme.radius.standard, cursor: "pointer",
            }}>删除 Key</button>
          )}
        </div>

        <div style={{ marginBottom: "28px" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: "13px", color: theme.text.tertiary, fontWeight: 510 }}>模型配置</h3>
          <label style={{ display: "block", marginBottom: "4px", fontSize: "13px", color: theme.text.secondary }}>模型名称</label>
          <input
            placeholder="如 glm-5.2, gpt-4o..."
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={{
              width: "100%", padding: "8px 14px", borderRadius: theme.radius.standard,
              border: `1px solid ${theme.border.standard}`, background: theme.bg.translucent,
              color: theme.text.primary, fontSize: "14px", outline: "none",
              marginBottom: "12px", boxSizing: "border-box", fontFamily: theme.font.family,
            }}
          />
          <label style={{ display: "block", marginBottom: "4px", fontSize: "13px", color: theme.text.secondary }}>Base URL</label>
          <input
            placeholder="如 https://njusehub.info/v1"
            value={baseURL}
            onChange={(e) => setBaseURL(e.target.value)}
            style={{
              width: "100%", padding: "8px 14px", borderRadius: theme.radius.standard,
              border: `1px solid ${theme.border.standard}`, background: theme.bg.translucent,
              color: theme.text.primary, fontSize: "14px", outline: "none",
              marginBottom: "12px", boxSizing: "border-box", fontFamily: theme.font.family,
            }}
          />
          <button onClick={saveConfig} style={{
            padding: "8px 20px", borderRadius: theme.radius.standard,
            background: theme.brand.indigo, color: "#fff", border: "none",
            fontSize: "14px", fontWeight: 510, cursor: "pointer",
          }}>保存配置</button>
        </div>

        {saved && (
          <div style={{
            padding: "10px", background: "rgba(39,166,68,0.1)", borderRadius: theme.radius.standard,
            color: theme.status.green, fontSize: "13px", textAlign: "center",
            border: `1px solid rgba(39,166,68,0.2)`,
          }}>已保存</div>
        )}

        <div style={{
          marginTop: "20px", padding: "14px", background: theme.bg.translucent,
          borderRadius: theme.radius.standard, fontSize: "12px", color: theme.text.tertiary,
          border: `1px solid ${theme.border.subtle}`, lineHeight: 1.6,
        }}>
          <b style={{ color: theme.text.secondary }}>说明：</b> API Key 优先从环境变量读取，其次从钥匙串，最后从 .env 文件。修改模型配置后需重启服务生效。
        </div>
      </div>
    </div>
  )
}
