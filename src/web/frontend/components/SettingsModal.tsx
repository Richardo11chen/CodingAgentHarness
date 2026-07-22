import { useState, useEffect } from "react"
import { theme } from "../theme"

interface ProviderPreset {
  key: string
  name: string
  baseURL: string
  model: string
  thinking?: boolean
}

interface SettingsModalProps {
  onClose: () => void
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState("")
  const [hasKey, setHasKey] = useState(false)
  const [model, setModel] = useState("")
  const [baseURL, setBaseURL] = useState("")
  const [thinking, setThinking] = useState(false)
  const [effort, setEffort] = useState("high")
  const [saved, setSaved] = useState(false)
  const [providers, setProviders] = useState<ProviderPreset[]>([])
  const [activeProvider, setActiveProvider] = useState("")
  const [customModel, setCustomModel] = useState("")
  const [providerKeys, setProviderKeys] = useState<Record<string, boolean>>({})
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/credentials").then(r => r.json()).then(d => setHasKey(d.hasKey))
    fetch("/api/providers").then(r => r.json()).then((d: ProviderPreset[]) => {
      setProviders(d)
      d.forEach(p => {
        fetch(`/api/providers/${p.key}/credentials`).then(r => r.json()).then(kd => {
          setProviderKeys(prev => ({ ...prev, [p.key]: kd.hasKey }))
        })
      })
    })
    fetch("/api/config").then(r => r.json()).then(d => {
      const cfg = d.llm
      setModel(cfg?.model ?? "")
      setBaseURL(cfg?.baseURL ?? "")
      setThinking(cfg?.thinking ?? false)
      setEffort(cfg?.reasoning_effort ?? "high")
      setActiveProvider(cfg?.provider ?? "")
    })
  }, [])

  const saveGlobalKey = async () => {
    if (!apiKey) return
    const res = await fetch("/api/credentials", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: apiKey }),
    })
    if (!res.ok) { alert("保存 Key 失败"); return }
    setHasKey(true)
    setApiKey("")
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const deleteGlobalKey = async () => {
    const res = await fetch("/api/credentials", { method: "DELETE" })
    if (!res.ok) { alert("删除 Key 失败"); return }
    setHasKey(false)
  }

  const saveProviderKey = async (providerKey: string) => {
    const key = (document.getElementById(`key-${providerKey}`) as HTMLInputElement)?.value
    if (!key) return
    const res = await fetch(`/api/providers/${providerKey}/credentials`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    })
    if (!res.ok) { alert("保存失败"); return }
    setProviderKeys(prev => ({ ...prev, [providerKey]: true }))
    ;(document.getElementById(`key-${providerKey}`) as HTMLInputElement).value = ""
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const deleteProviderKey = async (providerKey: string) => {
    const res = await fetch(`/api/providers/${providerKey}/credentials`, { method: "DELETE" })
    if (!res.ok) { alert("删除失败"); return }
    setProviderKeys(prev => ({ ...prev, [providerKey]: false }))
  }

  const applyProvider = async (key: string) => {
    const res = await fetch("/api/providers/activate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    })
    if (!res.ok) { alert("切换供应商失败"); return }
    const d = await res.json()
    setModel(d.model)
    setThinking(d.thinking ?? false)
    setEffort(d.reasoning_effort ?? "high")
    setActiveProvider(key)
    setCustomModel("")
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const toggleExpanded = (key: string) => {
    setExpandedProvider(prev => prev === key ? null : key)
  }

  const saveCustom = async () => {
    const m = customModel || model
    await fetch("/api/config", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ llm: { model: m, baseURL, thinking } }),
    })
    setModel(m)
    setCustomModel("")
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const activePreset = providers.find(p => p.key === activeProvider)

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
    }}>
      <div style={{
        background: theme.bg.surface, borderRadius: theme.radius.panel, padding: "28px",
        width: "560px", maxHeight: "85vh", overflowY: "auto",
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

        {/* 通用 API Key */}
        <div style={{ marginBottom: "20px" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: "13px", color: theme.text.tertiary, fontWeight: 510 }}>通用 API Key（回退用）</h3>
          <div style={{ marginBottom: "8px", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: hasKey ? theme.status.green : theme.status.red }} />
            <span style={{ color: hasKey ? theme.status.green : theme.status.red }}>{hasKey ? "已配置" : "未配置"}</span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <input type="password" placeholder="输入通用 API Key（回退用）..."
              value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              style={{
                flex: 1, padding: "8px 14px", borderRadius: theme.radius.standard,
                border: `1px solid ${theme.border.standard}`, background: theme.bg.translucent,
                color: theme.text.primary, fontSize: "14px", outline: "none", fontFamily: theme.font.family,
              }}
            />
            <button onClick={saveGlobalKey} style={{
              padding: "8px 16px", borderRadius: theme.radius.standard, background: theme.brand.indigo,
              color: "#fff", border: "none", fontSize: "13px", fontWeight: 510, cursor: "pointer",
            }}>保存</button>
          </div>
          {hasKey && (
            <button onClick={deleteGlobalKey} style={{
              marginTop: "6px", padding: "4px 12px", fontSize: "12px", background: "transparent",
              color: theme.status.red, border: `1px solid ${theme.border.standard}`,
              borderRadius: theme.radius.standard, cursor: "pointer",
            }}>删除通用 Key</button>
          )}
        </div>

        {/* 供应商列表 */}
        <div style={{ marginBottom: "20px" }}>
          <h3 style={{ margin: "0 0 10px", fontSize: "13px", color: theme.text.tertiary, fontWeight: 510 }}>供应商（点击切换）</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {providers.map(p => (
              <div key={p.key} style={{
                borderRadius: theme.radius.standard,
                background: activeProvider === p.key ? "rgba(94,106,210,0.12)" : theme.bg.translucent,
                border: activeProvider === p.key ? `1px solid rgba(94,106,210,0.3)` : `1px solid ${theme.border.subtle}`,
                overflow: "hidden",
              }}>
                {/* 供应商头部 */}
                <div onClick={() => applyProvider(p.key)} style={{
                  padding: "10px 14px", cursor: "pointer",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ color: theme.text.primary, fontSize: "14px", fontWeight: 510 }}>{p.name}</span>
                      {p.thinking && <span style={{
                        fontSize: "11px", padding: "1px 6px", borderRadius: "3px",
                        background: "rgba(113,112,255,0.15)", color: theme.brand.violet,
                      }}>思考</span>}
                      {activeProvider === p.key && <span style={{ color: theme.brand.indigo, fontSize: "13px" }}>✓ 当前</span>}
                    </div>
                    <div style={{ color: theme.text.tertiary, fontSize: "12px", marginTop: "2px" }}>
                      {p.model} · {p.baseURL}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <span style={{
                      width: "8px", height: "8px", borderRadius: "50%",
                      background: providerKeys[p.key] ? theme.status.green : theme.status.red,
                    }} title={providerKeys[p.key] ? "已配置 Key" : "未配置 Key"} />
                    <button onClick={(e) => { e.stopPropagation(); toggleExpanded(p.key) }} style={{
                      background: "transparent", border: "none", color: theme.text.tertiary,
                      fontSize: "12px", cursor: "pointer", padding: "2px",
                    }}>{expandedProvider === p.key ? "▲" : "▼"}</button>
                  </div>
                </div>

                {/* 展开的 Key 输入 */}
                {expandedProvider === p.key && (
                  <div style={{
                    padding: "8px 14px 12px", borderTop: `1px solid ${theme.border.subtle}`,
                    background: "rgba(0,0,0,0.1)",
                  }}>
                    <div style={{ fontSize: "12px", color: theme.text.tertiary, marginBottom: "6px" }}>
                      {p.name} 专属 API Key（覆盖通用 Key）
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <input id={`key-${p.key}`} type="password"
                        placeholder="输入该供应商的 API Key..."
                        style={{
                          flex: 1, padding: "6px 12px", borderRadius: theme.radius.standard,
                          border: `1px solid ${theme.border.standard}`, background: theme.bg.translucent,
                          color: theme.text.primary, fontSize: "13px", outline: "none", fontFamily: theme.font.family,
                        }}
                      />
                      <button onClick={() => saveProviderKey(p.key)} style={{
                        padding: "6px 14px", borderRadius: theme.radius.standard, background: theme.brand.indigo,
                        color: "#fff", border: "none", fontSize: "12px", cursor: "pointer",
                      }}>保存</button>
                    </div>
                    {providerKeys[p.key] && (
                      <button onClick={() => deleteProviderKey(p.key)} style={{
                        marginTop: "6px", padding: "3px 10px", fontSize: "11px", background: "transparent",
                        color: theme.status.red, border: `1px solid ${theme.border.standard}`,
                        borderRadius: theme.radius.standard, cursor: "pointer",
                      }}>删除 {p.name} Key</button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 自定义模型 */}
        <div style={{ marginBottom: "20px" }}>
          <h3 style={{ margin: "0 0 10px", fontSize: "13px", color: theme.text.tertiary, fontWeight: 510 }}>
            自定义模型 {activePreset && <span style={{ color: theme.text.quaternary, fontWeight: 400 }}>(当前: {activePreset.name})</span>}
          </h3>
          <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            <input placeholder={model || "模型名称..."}
              value={customModel} onChange={(e) => setCustomModel(e.target.value)}
              style={{
                flex: 1, padding: "8px 14px", borderRadius: theme.radius.standard,
                border: `1px solid ${theme.border.standard}`, background: theme.bg.translucent,
                color: theme.text.primary, fontSize: "14px", outline: "none", fontFamily: theme.font.family,
              }}
            />
            <button onClick={saveCustom} style={{
              padding: "8px 16px", borderRadius: theme.radius.standard, background: theme.bg.translucentActive,
              color: theme.text.secondary, border: `1px solid ${theme.border.standard}`,
              fontSize: "13px", cursor: "pointer",
            }}>应用</button>
          </div>
          <label style={{ display: "block", marginBottom: "4px", fontSize: "13px", color: theme.text.secondary }}>Base URL</label>
          <input placeholder="https://api.example.com/v1"
            value={baseURL} onChange={(e) => setBaseURL(e.target.value)}
            style={{
              width: "100%", padding: "8px 14px", borderRadius: theme.radius.standard,
              border: `1px solid ${theme.border.standard}`, background: theme.bg.translucent,
              color: theme.text.primary, fontSize: "14px", outline: "none",
              marginBottom: "10px", boxSizing: "border-box", fontFamily: theme.font.family,
            }}
          />
          <button onClick={saveCustom} style={{
            padding: "8px 20px", borderRadius: theme.radius.standard,
            background: theme.brand.indigo, color: "#fff", border: "none",
            fontSize: "14px", fontWeight: 510, cursor: "pointer",
          }}>保存自定义配置</button>
        </div>

        {/* Thinking 开关 */}
        <div style={{
          marginBottom: "16px", padding: "12px 14px", borderRadius: theme.radius.standard,
          background: theme.bg.translucent, border: `1px solid ${theme.border.subtle}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ color: theme.text.primary, fontSize: "14px", fontWeight: 510 }}>Thinking 模式</div>
            <div style={{ color: theme.text.tertiary, fontSize: "12px", marginTop: "2px" }}>
              {thinking ? "已启用 · 模型将在响应中包含思考过程" : "已禁用 · 仅返回最终回答"}
            </div>
          </div>
          <button onClick={async () => {
            const newVal = !thinking
            await fetch("/api/config", {
              method: "PUT", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ llm: { thinking: newVal } }),
            })
            setThinking(newVal)
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
          }} style={{
            width: "48px", height: "26px", borderRadius: "13px", border: "none", cursor: "pointer",
            background: thinking ? theme.brand.indigo : theme.bg.translucentActive,
            position: "relative", transition: "background 0.2s",
          }}>
            <span style={{
              position: "absolute", top: "3px", left: thinking ? "25px" : "3px",
              width: "20px", height: "20px", borderRadius: "50%", background: "#fff",
              transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            }} />
          </button>
        </div>

        {/* 思考强度 */}
        {thinking && (
          <div style={{
            marginBottom: "16px", padding: "12px 14px", borderRadius: theme.radius.standard,
            background: theme.bg.translucent, border: `1px solid ${theme.border.subtle}`,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: theme.text.primary, fontSize: "14px", fontWeight: 510 }}>思考强度</div>
                <div style={{ color: theme.text.tertiary, fontSize: "12px", marginTop: "2px" }}>
                  控制模型推理深度，强度越高回答质量越好但耗时更长
                </div>
              </div>
              <select
                value={effort}
                onChange={async (e) => {
                  const val = e.target.value
                  setEffort(val)
                  await fetch("/api/config", {
                    method: "PUT", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ llm: { reasoning_effort: val } }),
                  })
                  setSaved(true)
                  setTimeout(() => setSaved(false), 2000)
                }}
                style={{
                  padding: "6px 10px", borderRadius: theme.radius.standard,
                  border: `1px solid ${theme.border.standard}`, background: theme.bg.translucent,
                  color: theme.text.primary, fontSize: "13px", outline: "none",
                  fontFamily: theme.font.family, cursor: "pointer",
                }}
              >
                <option value="high">High</option>
                <option value="max">Max</option>
              </select>
            </div>
          </div>
        )}

        {saved && (
          <div style={{
            padding: "10px", background: "rgba(39,166,68,0.1)", borderRadius: theme.radius.standard,
            color: theme.status.green, fontSize: "13px", textAlign: "center",
            border: "1px solid rgba(39,166,68,0.2)",
          }}>设置已保存</div>
        )}

        <div style={{
          marginTop: "20px", padding: "14px", background: theme.bg.translucent,
          borderRadius: theme.radius.standard, fontSize: "12px", color: theme.text.tertiary,
          border: `1px solid ${theme.border.subtle}`, lineHeight: 1.6,
        }}>
          <b style={{ color: theme.text.secondary }}>说明：</b> 每个供应商可配置专属 API Key，切换供应商时自动使用对应的 Key。DeepSeek 的 thinking 模式会显示模型的推理过程。未配置专属 Key 时回退使用通用 Key。
        </div>
      </div>
    </div>
  )
}
