import { useState, useCallback, useEffect, useRef } from "react"
import { ChatPanel } from "./components/ChatPanel"
import { MonitorPanel } from "./components/MonitorPanel"
import { ApprovalModal } from "./components/ApprovalModal"
import { SettingsModal } from "./components/SettingsModal"
import { ConversationList } from "./components/ConversationList"
import { useWebSocket } from "./hooks/useWebSocket"
import { theme } from "./theme"

const CONV_KEY = "harness_conversations"
const ACTIVE_KEY = "harness_active_conv"

interface Conversation {
  id: string
  sessionId: string | null
  title: string
  messages: { role: string; content: string }[]
  createdAt: number
}

export function App() {
  const { events, connected } = useWebSocket()
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try { return JSON.parse(localStorage.getItem(CONV_KEY) ?? "[]") } catch { return [] }
  })
  const [activeId, setActiveId] = useState<string | null>(() => localStorage.getItem(ACTIVE_KEY))
  const [pendingApproval, setPendingApproval] = useState<{ action: any; policy: any; sessionId: string | null } | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [runningConvId, setRunningConvId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const seenDone = useRef(0)
  const seenErr = useRef(0)
  const pendingReply = useRef<{ convId: string; sessionId: string } | null>(null)
  const runTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const seenApproval = useRef(0)

  const activeConv = conversations.find(c => c.id === activeId) ?? null
  const running = runningConvId !== null

  useEffect(() => {
    fetch("/api/credentials").then(r => r.json()).then(d => setHasKey(d.hasKey)).catch(() => {})
  }, [showSettings])

  useEffect(() => {
    const stored = JSON.parse(sessionStorage.getItem("harness_events") ?? "[]")
    seenDone.current = stored.filter((e: any) => e.type === "done" && e.data?.steps !== undefined).length
    seenErr.current = stored.filter((e: any) => e.type === "error").length
  }, [])

  useEffect(() => {
    if (!activeId && conversations.length === 0) {
      const id = `conv-${Date.now()}`
      const conv: Conversation = { id, sessionId: null, title: "", messages: [], createdAt: Date.now() }
      setConversations([conv])
      setActiveId(id)
      localStorage.setItem(ACTIVE_KEY, id)
    }
  }, [activeId, conversations.length])

  const persistConvs = useCallback((convs: Conversation[]) => {
    localStorage.setItem(CONV_KEY, JSON.stringify(convs))
  }, [])

  const updateConv = useCallback((id: string, updater: (c: Conversation) => Conversation) => {
    setConversations(prev => {
      const next = prev.map(c => c.id === id ? updater(c) : c)
      persistConvs(next)
      return next
    })
  }, [persistConvs])

  const handleNew = useCallback(() => {
    const id = `conv-${Date.now()}`
    const conv: Conversation = { id, sessionId: null, title: "", messages: [], createdAt: Date.now() }
    setConversations(prev => {
      const next = [conv, ...prev]
      persistConvs(next)
      return next
    })
    setActiveId(id)
    localStorage.setItem(ACTIVE_KEY, id)
  }, [persistConvs])

  const handleSelect = useCallback((id: string) => {
    setActiveId(id)
    localStorage.setItem(ACTIVE_KEY, id)
  }, [])

  const handleSend = useCallback(async (message: string) => {
    if (running || !activeConv) return

    const convId = activeConv.id
    const userMsg = { role: "user", content: message }
    updateConv(convId, c => ({
      ...c,
      messages: [...c.messages, userMsg],
      title: c.title || message.slice(0, 30),
    }))
    setRunningConvId(convId)

    let sid = activeConv.sessionId
    try {
      if (!sid) {
        const res = await fetch("/api/sessions", { method: "POST" })
        if (!res.ok) throw new Error("Failed to create session")
        const data = await res.json()
        sid = data.id
        updateConv(convId, c => ({ ...c, sessionId: sid! }))
      }

      pendingReply.current = { convId, sessionId: sid! }
      if (runTimeoutRef.current) clearTimeout(runTimeoutRef.current)
      runTimeoutRef.current = setTimeout(() => {
        setRunningConvId(null)
        pendingReply.current = null
        updateConv(convId, c => ({ ...c, messages: [...c.messages, { role: "assistant", content: "Error: Request timed out" }] }))
      }, 300000)

      let res = await fetch(`/api/sessions/${sid}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      })

      if (res.status === 404) {
        const newRes = await fetch("/api/sessions", { method: "POST" })
        if (!newRes.ok) throw new Error("Failed to create session")
        const newData = await newRes.json()
        sid = newData.id
        updateConv(convId, c => ({ ...c, sessionId: sid! }))
        pendingReply.current = { convId, sessionId: sid! }
        if (runTimeoutRef.current) clearTimeout(runTimeoutRef.current)
        runTimeoutRef.current = setTimeout(() => {
          setRunningConvId(null)
          pendingReply.current = null
          updateConv(convId, c => ({ ...c, messages: [...c.messages, { role: "assistant", content: "Error: Request timed out" }] }))
        }, 300000)

        res = await fetch(`/api/sessions/${sid}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        })
      }

      if (!res.ok) {
        const err = await res.json()
        updateConv(convId, c => ({
          ...c,
          messages: [...c.messages, { role: "assistant", content: `Error: ${err.error ?? "Request failed"}` }],
        }))
        setRunningConvId(null)
        pendingReply.current = null
        if (runTimeoutRef.current) { clearTimeout(runTimeoutRef.current); runTimeoutRef.current = undefined }
      }
    } catch (err: any) {
      updateConv(convId, c => ({
        ...c,
        messages: [...c.messages, { role: "assistant", content: `Error: ${err.message}` }],
      }))
      setRunningConvId(null)
      pendingReply.current = null
      if (runTimeoutRef.current) { clearTimeout(runTimeoutRef.current); runTimeoutRef.current = undefined }
    }
  }, [activeConv, running, updateConv])

  useEffect(() => {
    const doneEvents = events.filter((e) => e.type === "done" && (e as any).data?.steps !== undefined)
    if (doneEvents.length > seenDone.current) {
      const newDones = doneEvents.slice(seenDone.current)
      seenDone.current = doneEvents.length
      for (const ev of newDones) {
        const answer = (ev as any).data?.answer
        const target = pendingReply.current
        if (answer && target) {
          updateConv(target.convId, c => ({ ...c, messages: [...c.messages, { role: "assistant", content: answer }] }))
        }
      }
      setRunningConvId(null)
      pendingReply.current = null
      if (runTimeoutRef.current) { clearTimeout(runTimeoutRef.current); runTimeoutRef.current = undefined }
    }
    const errEvents = events.filter((e) => e.type === "error")
    if (errEvents.length > seenErr.current) {
      const newErrs = errEvents.slice(seenErr.current)
      seenErr.current = errEvents.length
      for (const ev of newErrs) {
        const msg = (ev as any).data?.message ?? "Unknown error"
        const target = pendingReply.current
        if (target) {
          updateConv(target.convId, c => ({ ...c, messages: [...c.messages, { role: "assistant", content: `Error: ${msg}` }] }))
        }
      }
      setRunningConvId(null)
      pendingReply.current = null
      if (runTimeoutRef.current) { clearTimeout(runTimeoutRef.current); runTimeoutRef.current = undefined }
    }
  }, [events, updateConv])

  useEffect(() => {
    const approvalEvents = events.filter((e) => e.type === "approval_request")
    if (approvalEvents.length > seenApproval.current) {
      const latest = approvalEvents[approvalEvents.length - 1]
      seenApproval.current = approvalEvents.length
      const target = pendingReply.current
      setPendingApproval({
        ...(latest as any).data,
        sessionId: target?.sessionId ?? null,
      })
    }
  }, [events, pendingApproval])

  const handleApprove = async () => {
    const sid = pendingApproval?.sessionId
    if (sid) {
      await fetch(`/api/sessions/${sid}/approve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: true }),
      })
    }
    setPendingApproval(null)
  }

  const handleDeny = async () => {
    const sid = pendingApproval?.sessionId
    if (sid) {
      await fetch(`/api/sessions/${sid}/approve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: false }),
      })
    }
    setPendingApproval(null)
  }

  const handleClear = useCallback(() => {
    if (!activeConv) return
    updateConv(activeConv.id, c => ({ ...c, messages: [], title: "", sessionId: null }))
  }, [activeConv, updateConv])

  return (
      <div style={{
        display: "flex", height: "100vh", background: theme.bg.marketing,
        fontFamily: theme.font.family, fontFeatureSettings: theme.font.features,
      }}>
      {sidebarOpen && (
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          onSelect={handleSelect}
          onNew={handleNew}
          runningConvId={runningConvId}
        />
      )}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
      <div style={{
        width: "32px", background: theme.bg.panel, borderRight: `1px solid ${theme.border.subtle}`,
        display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "12px", flexShrink: 0,
      }}>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
          background: "transparent", border: "none", color: theme.text.tertiary,
          fontSize: "16px", cursor: "pointer", padding: "4px",
        }}>{sidebarOpen ? "◀" : "▶"}</button>
      </div>
      <ChatPanel onSend={handleSend} messages={activeConv?.messages ?? []} onClear={handleClear} running={running} />
      <MonitorPanel events={events} />
      </div>
      {hasKey === false && (
        <div style={{
          padding: "8px 16px", background: "rgba(245,158,11,0.1)",
          borderBottom: `1px solid rgba(245,158,11,0.2)`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: "13px", color: theme.status.yellow,
        }}>
          <span>未配置 API Key，请先设置后再发消息</span>
          <button onClick={() => setShowSettings(true)} style={{
            padding: "4px 14px", fontSize: "12px", border: `1px solid ${theme.border.standard}`,
            borderRadius: theme.radius.standard, background: theme.brand.indigo,
            color: "#fff", cursor: "pointer", fontWeight: 510,
          }}>去设置</button>
        </div>
      )}
      <ApprovalModal
        action={pendingApproval?.action ?? null}
        policy={pendingApproval?.policy ?? null}
        onApprove={handleApprove}
        onDeny={handleDeny}
      />
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      <div style={{
        padding: "6px 16px", flexShrink: 0,
        background: theme.bg.panel, borderTop: `1px solid ${theme.border.subtle}`,
        fontSize: "12px", display: "flex", justifyContent: "space-between", alignItems: "center",
        color: theme.text.tertiary,
      }}>
        <span>
          <span style={{ color: connected ? theme.status.green : theme.status.red }}>
            {connected ? "●" : "●"}{" "}
          </span>
          {connected ? "Connected" : "Disconnected"} | Session: {activeConv?.sessionId ?? "none"} | Events: {events.length}
          {running && " | Running..."}
        </span>
        <button onClick={() => setShowSettings(true)} style={{
          padding: "4px 14px", fontSize: "12px", border: `1px solid ${theme.border.standard}`,
          borderRadius: theme.radius.standard, background: theme.bg.translucent,
          color: theme.text.secondary, cursor: "pointer",
          fontFamily: theme.font.family, fontWeight: 510,
        }}>设置</button>
      </div>
      </div>
    </div>
  )
}
