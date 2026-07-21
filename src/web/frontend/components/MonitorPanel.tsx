import { useState } from "react"
import { theme } from "../theme"

export function MonitorPanel({ events }: { events: any[] }) {
  const [expanded, setExpanded] = useState(true)

  const filtered = events.filter((e) => !(e.type === "done" && e.data?.steps === undefined))

  const icon = (type: string) => {
    const map: Record<string, string> = {
      thinking: "🧠", action: "🔧", governance: "🛡️", tool_start: "⚡",
      tool_result: "📋", feedback: "📊", approval_request: "⚠️", done: "✅", error: "❌", step: "👣",
    }
    return map[type] ?? "•"
  }

  const typeColor = (type: string) => {
    const map: Record<string, string> = {
      thinking: theme.text.tertiary, action: theme.brand.violet, governance: theme.status.yellow,
      tool_start: theme.status.emerald, tool_result: theme.text.secondary, done: theme.status.green,
      error: theme.status.red, step: theme.text.quaternary, feedback: theme.status.yellow,
      approval_request: theme.status.yellow,
    }
    return map[type] ?? theme.text.secondary
  }

  if (!expanded) {
    return (
      <div
        onClick={() => setExpanded(true)}
        style={{
          width: "44px", cursor: "pointer", background: theme.bg.panel,
          borderLeft: `1px solid ${theme.border.subtle}`, padding: "8px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
        }}
      >
        <span style={{ fontSize: "16px" }}>📊</span>
        <span style={{ writingMode: "vertical-rl", fontSize: "11px", color: theme.text.tertiary, fontWeight: 510 }}>
          监控 ({filtered.length})
        </span>
      </div>
    )
  }

  return (
    <div style={{
      width: "340px", background: theme.bg.panel,
      borderLeft: `1px solid ${theme.border.subtle}`, display: "flex", flexDirection: "column",
    }}>
      <div onClick={() => setExpanded(false)} style={{
        padding: "12px 16px", cursor: "pointer", borderBottom: `1px solid ${theme.border.subtle}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ color: theme.text.primary, fontSize: "14px", fontWeight: 510, fontFamily: theme.font.family }}>
          监控
        </span>
        <span style={{ color: theme.text.tertiary, fontSize: "12px" }}>{filtered.length} events</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
        {filtered.length === 0 && (
          <div style={{ color: theme.text.quaternary, fontSize: "13px", textAlign: "center", marginTop: "40%" }}>
            等待事件...
          </div>
        )}
        {filtered.slice(-80).map((e, i) => (
          <div key={i} style={{
            marginBottom: "6px", padding: "6px 10px", borderRadius: theme.radius.small,
            background: theme.bg.translucent, fontSize: "12px", fontFamily: theme.font.mono,
            border: `1px solid ${theme.border.subtle}`,
          }}>
            <span style={{ marginRight: "6px" }}>{icon(e.type)}</span>
            <span style={{ color: typeColor(e.type), fontWeight: 510 }}>{e.type}</span>
            <span style={{ color: theme.text.tertiary, marginLeft: "8px" }}>
              {JSON.stringify(e.data).slice(0, 100)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
