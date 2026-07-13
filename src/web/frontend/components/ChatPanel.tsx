import { useState } from "react"

interface ChatPanelProps {
  onSend: (message: string) => void
  messages: { role: string; content: string }[]
}

export function ChatPanel({ onSend, messages }: ChatPanelProps) {
  const [input, setInput] = useState("")

  const handleSend = () => {
    if (input.trim()) {
      onSend(input)
      setInput("")
    }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "16px" }}>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: "8px", textAlign: m.role === "user" ? "right" : "left" }}>
            <span style={{
              display: "inline-block", padding: "8px 12px", borderRadius: "8px",
              background: m.role === "user" ? "#3b82f6" : "#e5e7eb",
              color: m.role === "user" ? "white" : "black",
            }}>{m.content}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          style={{ flex: 1, padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="输入消息..."
        />
        <button onClick={handleSend} style={{ padding: "8px 16px" }}>发送</button>
      </div>
    </div>
  )
}
