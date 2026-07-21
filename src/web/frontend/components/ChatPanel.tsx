import { useState } from "react"
import { theme } from "../theme"

interface ChatPanelProps {
  onSend: (message: string) => void
  messages: { role: string; content: string }[]
  onClear?: () => void
}

export function ChatPanel({ onSend, messages, onClear }: ChatPanelProps) {
  const [input, setInput] = useState("")

  const handleSend = () => {
    if (input.trim()) {
      onSend(input)
      setInput("")
    }
  }

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      background: theme.bg.panel, borderRight: `1px solid ${theme.border.subtle}`,
      fontFamily: theme.font.family, fontFeatureSettings: theme.font.features,
    }}>
      <div style={{
        padding: "12px 16px", borderBottom: `1px solid ${theme.border.subtle}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ color: theme.text.primary, fontSize: "14px", fontWeight: 510 }}>对话</span>
        {onClear && (
          <button onClick={onClear} style={{
            background: "transparent", border: "none", color: theme.text.tertiary,
            fontSize: "12px", cursor: "pointer", padding: "2px 8px", borderRadius: theme.radius.standard,
          }}>清空</button>
        )}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {messages.length === 0 && (
          <div style={{ color: theme.text.quaternary, fontSize: "14px", textAlign: "center", marginTop: "40%" }}>
            输入消息开始对话
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{
            marginBottom: "12px", display: "flex",
            justifyContent: m.role === "user" ? "flex-end" : "flex-start",
          }}>
            <span style={{
              maxWidth: "80%", padding: "8px 14px",
              borderRadius: m.role === "user" ? `${theme.radius.standard} ${theme.radius.standard} 2px ${theme.radius.standard}` : `${theme.radius.standard} ${theme.radius.standard} ${theme.radius.standard} 2px`,
              background: m.role === "user" ? theme.brand.indigo : theme.bg.translucentActive,
              color: m.role === "user" ? "#fff" : theme.text.primary,
              fontSize: "14px", lineHeight: 1.5,
              border: m.role === "user" ? "none" : `1px solid ${theme.border.standard}`,
            }}>{m.content}</span>
          </div>
        ))}
      </div>
      <div style={{
        padding: "12px 16px", borderTop: `1px solid ${theme.border.subtle}`,
        display: "flex", gap: "8px",
      }}>
        <input
          style={{
            flex: 1, padding: "8px 14px", borderRadius: theme.radius.standard,
            border: `1px solid ${theme.border.standard}`, background: theme.bg.translucent,
            color: theme.text.primary, fontSize: "14px", outline: "none",
            fontFamily: theme.font.family, fontFeatureSettings: theme.font.features,
          }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="输入消息..."
        />
        <button onClick={handleSend} style={{
          padding: "8px 20px", borderRadius: theme.radius.standard,
          background: theme.brand.indigo, color: "#fff", border: "none",
          fontSize: "14px", fontWeight: 510, cursor: "pointer",
          fontFamily: theme.font.family,
        }}>发送</button>
      </div>
    </div>
  )
}
