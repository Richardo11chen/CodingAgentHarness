import { useState, useCallback, useEffect, useRef } from "react"
import { ChatPanel } from "./components/ChatPanel"
import { MonitorPanel } from "./components/MonitorPanel"
import { ApprovalModal } from "./components/ApprovalModal"
import { SettingsModal } from "./components/SettingsModal"
import { useWebSocket } from "./hooks/useWebSocket"

const MSG_KEY = "harness_messages"
const SID_KEY = "harness_session"

export function App() {
  const { events, connected } = useWebSocket()
  const [messages, setMessages] = useState<{ role: string; content: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem(MSG_KEY) ?? "[]") } catch { return [] }
  })
  const [sessionId, setSessionId] = useState<string | null>(() => localStorage.getItem(SID_KEY))
  const [pendingApproval, setPendingApproval] = useState<{ action: any; policy: any } | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const seenDone = useRef(0)
  const seenErr = useRef(0)

  useEffect(() => {
    const stored = JSON.parse(sessionStorage.getItem("harness_events") ?? "[]")
    seenDone.current = stored.filter((e: any) => e.type === "done" && e.data?.steps !== undefined).length
    seenErr.current = stored.filter((e: any) => e.type === "error").length
  }, [])

  const persistMsgs = useCallback((msgs: { role: string; content: string }[]) => {
    localStorage.setItem(MSG_KEY, JSON.stringify(msgs))
  }, [])

  const handleSend = useCallback(async (message: string) => {
    const userMsg = { role: "user", content: message }
    setMessages((prev) => {
      const next = [...prev, userMsg]
      persistMsgs(next)
      return next
    })
    let sid = sessionId
    if (!sid) {
      const res = await fetch("/api/sessions", { method: "POST" })
      const data = await res.json()
      sid = data.id
      setSessionId(sid)
      localStorage.setItem(SID_KEY, sid!)
    }
    await fetch(`/api/sessions/${sid}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    })
  }, [sessionId, persistMsgs])

  useEffect(() => {
    const doneEvents = events.filter((e) => e.type === "done" && (e as any).data?.steps !== undefined)
    if (doneEvents.length > seenDone.current) {
      const newDones = doneEvents.slice(seenDone.current)
      seenDone.current = doneEvents.length
      for (const ev of newDones) {
        const answer = (ev as any).data?.answer
        if (answer) {
          setMessages((prev) => {
            const next = [...prev, { role: "assistant", content: answer }]
            persistMsgs(next)
            return next
          })
        }
      }
    }
    const errEvents = events.filter((e) => e.type === "error")
    if (errEvents.length > seenErr.current) {
      const newErrs = errEvents.slice(seenErr.current)
      seenErr.current = errEvents.length
      for (const ev of newErrs) {
        const msg = (ev as any).data?.message ?? "Unknown error"
        setMessages((prev) => {
          const next = [...prev, { role: "assistant", content: `Error: ${msg}` }]
          persistMsgs(next)
          return next
        })
      }
    }
  }, [events, persistMsgs])

  useEffect(() => {
    const approvalEvent = events.find((e) => e.type === "approval_request")
    if (approvalEvent && !pendingApproval) {
      setPendingApproval((approvalEvent as any).data)
    }
  }, [events, pendingApproval])

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

  const handleClear = useCallback(() => {
    setMessages([])
    persistMsgs([])
    localStorage.removeItem(SID_KEY)
    setSessionId(null)
    seenDone.current = 0
    seenErr.current = 0
  }, [persistMsgs])

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <ChatPanel onSend={handleSend} messages={messages} onClear={handleClear} />
      <MonitorPanel events={events} />
      <ApprovalModal
        action={pendingApproval?.action ?? null}
        policy={pendingApproval?.policy ?? null}
        onApprove={handleApprove}
        onDeny={handleDeny}
      />
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "4px 16px", background: "#f3f4f6", fontSize: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{connected ? "🟢 Connected" : "🔴 Disconnected"} | Session: {sessionId ?? "none"} | Events: {events.length}</span>
        <button onClick={() => setShowSettings(true)} style={{ padding: "2px 12px", fontSize: "12px", border: "1px solid #ccc", borderRadius: "4px", background: "white", cursor: "pointer" }}>设置</button>
      </div>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
