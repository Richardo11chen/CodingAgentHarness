import { useState } from "react"
import ReactMarkdown from "react-markdown"
import { theme } from "../theme"

interface ChatPanelProps {
  onSend: (message: string) => void
  messages: { role: string; content: string }[]
  onClear?: () => void
  running?: boolean
}

export function ChatPanel({ onSend, messages, onClear, running }: ChatPanelProps) {
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
            <div style={{
              maxWidth: "80%", padding: "8px 14px",
              borderRadius: m.role === "user" ? `${theme.radius.standard} ${theme.radius.standard} 2px ${theme.radius.standard}` : `${theme.radius.standard} ${theme.radius.standard} ${theme.radius.standard} 2px`,
              background: m.role === "user" ? theme.brand.indigo : theme.bg.translucentActive,
              color: m.role === "user" ? "#fff" : theme.text.primary,
              fontSize: "14px", lineHeight: 1.6,
              border: m.role === "user" ? "none" : `1px solid ${theme.border.standard}`,
            }}>
              {m.role === "user" ? m.content : (
                <ReactMarkdown components={{
                  code: ({ node, ...props }: any) => props?.inline ? (
                    <code style={{
                      background: "rgba(255,255,255,0.1)", padding: "1px 4px",
                      borderRadius: "3px", fontSize: "13px", fontFamily: theme.font.mono,
                    }}>{props.children}</code>
                  ) : (
                    <pre style={{
                      background: "rgba(0,0,0,0.3)", padding: "10px 12px",
                      borderRadius: theme.radius.standard, overflowX: "auto",
                      margin: "8px 0",
                    }}>
                      <code style={{ fontFamily: theme.font.mono, fontSize: "13px", color: theme.text.secondary }}>{props.children}</code>
                    </pre>
                  ),
                  p: ({ children }) => <p style={{ margin: "4px 0" }}>{children}</p>,
                  ul: ({ children }) => <ul style={{ margin: "4px 0", paddingLeft: "20px" }}>{children}</ul>,
                  ol: ({ children }) => <ol style={{ margin: "4px 0", paddingLeft: "20px" }}>{children}</ol>,
                  h1: ({ children }) => <h1 style={{ fontSize: "18px", fontWeight: 590, margin: "8px 0 4px" }}>{children}</h1>,
                  h2: ({ children }) => <h2 style={{ fontSize: "16px", fontWeight: 590, margin: "8px 0 4px" }}>{children}</h2>,
                  h3: ({ children }) => <h3 style={{ fontSize: "15px", fontWeight: 590, margin: "6px 0 4px" }}>{children}</h3>,
                  a: ({ href, children }) => <a href={href} style={{ color: theme.brand.violet, textDecoration: "none" }}>{children}</a>,
                  blockquote: ({ children }) => <blockquote style={{ borderLeft: `2px solid ${theme.border.standard}`, margin: "4px 0", paddingLeft: "12px", color: theme.text.tertiary }}>{children}</blockquote>,
                }}>{m.content}</ReactMarkdown>
              )}
            </div>
          </div>
        ))}
      </div>
      <div style={{
        padding: "12px 16px", borderTop: `1px solid ${theme.border.subtle}`,
        display: "flex", gap: "8px",
      }}>
        <textarea
          style={{
            flex: 1, padding: "8px 14px", borderRadius: theme.radius.standard,
            border: `1px solid ${theme.border.standard}`, background: theme.bg.translucent,
            color: theme.text.primary, fontSize: "14px", outline: "none",
            fontFamily: theme.font.family, fontFeatureSettings: theme.font.features,
            resize: "none", minHeight: "38px", maxHeight: "120px",
          }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="输入消息... (Shift+Enter 换行)"
          rows={1}
        />
        <button onClick={handleSend} disabled={running} style={{
          padding: "8px 20px", borderRadius: theme.radius.standard,
          background: running ? theme.bg.translucentActive : theme.brand.indigo,
          color: running ? theme.text.tertiary : "#fff", border: "none",
          fontSize: "14px", fontWeight: 510, cursor: running ? "not-allowed" : "pointer",
          fontFamily: theme.font.family,
        }}>{running ? "运行中..." : "发送"}</button>
      </div>
    </div>
  )
}
