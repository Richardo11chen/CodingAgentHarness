import { useState, useCallback } from "react"
import { ChatPanel } from "./components/ChatPanel"
import { MonitorPanel } from "./components/MonitorPanel"
import { ApprovalModal } from "./components/ApprovalModal"
import { useWebSocket } from "./hooks/useWebSocket"
import type { TraceEvent } from "../core/types"

export function App() {
  const { events, connected } = useWebSocket()
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [pendingApproval, setPendingApproval] = useState<{ action: any; policy: any } | null>(null)

  const handleSend = useCallback(async (message: string) => {
    setMessages((prev) => [...prev, { role: "user", content: message }])
    if (!sessionId) {
      const res = await fetch("/api/sessions", { method: "POST" })
      const data = await res.json()
      setSessionId(data.id)
    }
    await fetch(`/api/sessions/${sessionId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    })
  }, [sessionId])

  const approvalEvent = events.find((e) => e.type === "approval_request")
  if (approvalEvent && !pendingApproval) {
    setPendingApproval(approvalEvent.data as any)
  }

  const handleApprove = async () => {
    await fetch(`/api/sessions/${sessionId}/approve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: true }),
    })
    setPendingApproval(null)
  }

  const handleDeny = async () => {
    await fetch(`/api/sessions/${sessionId}/approve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: false }),
    })
    setPendingApproval(null)
  }

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <ChatPanel onSend={handleSend} messages={messages} />
      <MonitorPanel events={events} />
      <ApprovalModal
        action={pendingApproval?.action ?? null}
        policy={pendingApproval?.policy ?? null}
        onApprove={handleApprove}
        onDeny={handleDeny}
      />
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "4px 16px", background: "#f3f4f6", fontSize: "12px" }}>
        {connected ? "🟢 Connected" : "🔴 Disconnected"} | Session: {sessionId ?? "none"}
      </div>
    </div>
  )
}
