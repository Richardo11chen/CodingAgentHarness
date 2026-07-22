import { useState } from "react"
import { theme } from "../theme"

interface ConversationListProps {
  conversations: { id: string; title: string; createdAt: number }[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  runningConvId?: string | null
}

export function ConversationList({ conversations, activeId, onSelect, onNew, onDelete, runningConvId }: ConversationListProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  return (
    <div style={{
      width: "200px", background: theme.bg.panel, borderRight: `1px solid ${theme.border.subtle}`,
      display: "flex", flexDirection: "column", flexShrink: 0,
      fontFamily: theme.font.family,
    }}>
      <div style={{ padding: "12px" }}>
        <button onClick={onNew} style={{
          width: "100%", padding: "8px", borderRadius: theme.radius.standard,
          background: theme.brand.indigo, color: "#fff", border: "none",
          fontSize: "13px", fontWeight: 510, cursor: "pointer",
        }}>+ 新对话</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 8px" }}>
        {conversations.length === 0 && (
          <div style={{ color: theme.text.quaternary, fontSize: "12px", textAlign: "center", marginTop: "20px" }}>
            暂无对话
          </div>
        )}
        {conversations.map((c) => (
          <div
            key={c.id}
            style={{
              padding: "6px 6px 6px 10px", borderRadius: theme.radius.standard, marginBottom: "2px",
              background: c.id === activeId ? theme.bg.translucentActive : "transparent",
              border: c.id === activeId ? `1px solid ${theme.border.standard}` : "1px solid transparent",
              display: "flex", alignItems: "center", gap: "4px",
            }}
          >
            <div
              onClick={() => onSelect(c.id)}
              style={{
                flex: 1, cursor: "pointer", fontSize: "13px",
                color: c.id === activeId ? theme.text.primary : theme.text.tertiary,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                display: "flex", alignItems: "center", gap: "6px",
              }}
            >
              {c.id === runningConvId && (
                <span style={{ fontSize: "11px", color: theme.status.yellow, flexShrink: 0 }}>●</span>
              )}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{c.title || "新对话"}</span>
            </div>
            {confirmDelete === c.id ? (
              <div style={{ display: "flex", gap: "2px", flexShrink: 0 }}>
                <button onClick={(e) => { e.stopPropagation(); onDelete(c.id); setConfirmDelete(null) }} style={{
                  padding: "2px 5px", fontSize: "11px", borderRadius: "3px",
                  background: theme.status.red, color: "#fff", border: "none", cursor: "pointer",
                }}>确认</button>
                <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(null) }} style={{
                  padding: "2px 5px", fontSize: "11px", borderRadius: "3px",
                  background: theme.bg.translucent, color: theme.text.tertiary, border: "none", cursor: "pointer",
                }}>取消</button>
              </div>
            ) : (
              <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(c.id) }} style={{
                padding: "2px 6px", fontSize: "14px", borderRadius: "3px",
                background: "transparent", color: theme.text.quaternary, border: "none",
                cursor: "pointer", flexShrink: 0, lineHeight: 1,
                opacity: c.id === activeId ? 0.6 : 0.3,
              }}>×</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
