import { theme } from "../theme"

interface ApprovalModalProps {
  action: any | null
  policy: any | null
  onApprove: () => void
  onDeny: () => void
}

export function ApprovalModal({ action, policy, onApprove, onDeny }: ApprovalModalProps) {
  if (!action) return null

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
    }}>
      <div style={{
        background: theme.bg.surface, borderRadius: theme.radius.panel, padding: "24px",
        width: "440px", border: `1px solid ${theme.border.standard}`,
        boxShadow: "rgba(0,0,0,0.4) 0px 8px 24px",
        fontFamily: theme.font.family, fontFeatureSettings: theme.font.features,
      }}>
        <div style={{ marginBottom: "16px" }}>
          <span style={{ fontSize: "20px" }}>⚠️</span>
          <span style={{ marginLeft: "8px", color: theme.text.primary, fontSize: "16px", fontWeight: 590 }}>
            需要人工审批
          </span>
        </div>
        <div style={{
          padding: "12px 14px", background: theme.bg.translucent, borderRadius: theme.radius.standard,
          border: `1px solid ${theme.border.standard}`, marginBottom: "16px",
        }}>
          <div style={{ color: theme.text.tertiary, fontSize: "12px", marginBottom: "4px" }}>动作</div>
          <div style={{ color: theme.text.primary, fontSize: "14px", fontFamily: theme.font.mono }}>
            {action.tool} {JSON.stringify(action.args)}
          </div>
        </div>
        {policy?.message && (
          <div style={{
            padding: "12px 14px", background: "rgba(245,158,11,0.08)", borderRadius: theme.radius.standard,
            border: `1px solid rgba(245,158,11,0.2)`, marginBottom: "16px",
          }}>
            <div style={{ color: theme.status.yellow, fontSize: "12px" }}>{policy.message}</div>
          </div>
        )}
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button onClick={onDeny} style={{
            padding: "8px 20px", borderRadius: theme.radius.standard,
            background: theme.bg.translucentActive, color: theme.text.secondary,
            border: `1px solid ${theme.border.standard}`, fontSize: "14px", fontWeight: 510, cursor: "pointer",
          }}>拒绝</button>
          <button onClick={onApprove} style={{
            padding: "8px 20px", borderRadius: theme.radius.standard,
            background: theme.brand.indigo, color: "#fff",
            border: "none", fontSize: "14px", fontWeight: 510, cursor: "pointer",
          }}>批准</button>
        </div>
      </div>
    </div>
  )
}
