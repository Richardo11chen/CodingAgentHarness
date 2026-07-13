import { useState } from "react"
import type { TraceEvent } from "../../../core/types"

export function MonitorPanel({ events }: { events: TraceEvent[] }) {
  const [expanded, setExpanded] = useState(false)

  const icon = (type: string) => {
    const map: Record<string, string> = {
      thinking: "🧠", action: "🔧", governance: "🛡️", tool_start: "⚡",
      tool_result: "📋", feedback: "📊", approval_request: "⚠️", done: "✅", error: "❌", step: "👣",
    }
    return map[type] ?? "•"
  }

  if (!expanded) {
    return (
      <div
        onClick={() => setExpanded(true)}
        style={{ width: "48px", cursor: "pointer", background: "#f3f4f6", padding: "8px", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}
      >
        <span>📊</span>
        <span style={{ writingMode: "vertical-rl", fontSize: "12px" }}>监控 ({events.length})</span>
      </div>
    )
  }

  return (
    <div style={{ width: "300px", background: "#f9fafb", padding: "8px", overflowY: "auto" }}>
      <div onClick={() => setExpanded(false)} style={{ cursor: "pointer", marginBottom: "8px", fontWeight: "bold" }}>
        监控 ▶
      </div>
      {events.slice(-50).map((e, i) => (
        <div key={i} style={{ marginBottom: "4px", fontSize: "12px", fontFamily: "monospace" }}>
          {icon(e.type)} {e.type}: {JSON.stringify(e.data).slice(0, 80)}
        </div>
      ))}
    </div>
  )
}
