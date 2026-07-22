import { theme } from "../theme"

interface ConversationListProps {
  conversations: { id: string; title: string; createdAt: number }[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  runningConvId?: string | null
}

export function ConversationList({ conversations, activeId, onSelect, onNew, runningConvId }: ConversationListProps) {
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
            onClick={() => onSelect(c.id)}
            style={{
              padding: "8px 10px", borderRadius: theme.radius.standard, marginBottom: "2px",
              cursor: "pointer", fontSize: "13px",
              background: c.id === activeId ? theme.bg.translucentActive : "transparent",
              color: c.id === activeId ? theme.text.primary : theme.text.tertiary,
              border: c.id === activeId ? `1px solid ${theme.border.standard}` : "1px solid transparent",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              display: "flex", alignItems: "center", gap: "6px",
            }}
          >
            {c.id === runningConvId && (
              <span style={{ fontSize: "11px", color: theme.status.yellow }}>●</span>
            )}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{c.title || "新对话"}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
