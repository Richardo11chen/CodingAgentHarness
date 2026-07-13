interface ApprovalModalProps {
  action: { tool?: string; args?: Record<string, unknown> } | null
  policy?: { message: string } | null
  onApprove: () => void
  onDeny: () => void
}

export function ApprovalModal({ action, policy, onApprove, onDeny }: ApprovalModalProps) {
  if (!action) return null
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "white", padding: "24px", borderRadius: "8px", maxWidth: "400px" }}>
        <h3>⚠️ 需要审批</h3>
        <p>{policy?.message ?? "此操作需要人工确认"}</p>
        <pre style={{ background: "#f3f4f6", padding: "8px", borderRadius: "4px", fontSize: "12px" }}>
          {JSON.stringify(action, null, 2)}
        </pre>
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button onClick={onDeny} style={{ padding: "8px 16px" }}>拒绝</button>
          <button onClick={onApprove} style={{ padding: "8px 16px", background: "#3b82f6", color: "white" }}>批准</button>
        </div>
      </div>
    </div>
  )
}
