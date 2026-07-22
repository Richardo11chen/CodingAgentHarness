import { useEffect, useState, useCallback, useRef } from "react"
import type { TraceEvent } from "../../../core/types"

const EVT_KEY = "harness_events"
const MAX_EVENTS = 200

export function useWebSocket(onDone: (e: any) => void, onError: (e: any) => void) {
  const [events, setEvents] = useState<TraceEvent[]>(() => {
    try { return JSON.parse(sessionStorage.getItem(EVT_KEY) ?? "[]") } catch { return [] }
  })
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>()
  const mountedRef = useRef(true)
  const tokenRef = useRef<string>("")
  const onDoneRef = useRef(onDone)
  const onErrorRef = useRef(onError)
  onDoneRef.current = onDone
  onErrorRef.current = onError

  const persist = useCallback((evs: TraceEvent[]) => {
    sessionStorage.setItem(EVT_KEY, JSON.stringify(evs.slice(-MAX_EVENTS)))
  }, [])

  const connect = useCallback(async () => {
    try {
      const r = await fetch("/api/auth-token")
      const d = await r.json()
      tokenRef.current = d.token ?? ""
    } catch {
      // token 获取失败，仍尝试连接
    }
    const protocol = location.protocol === "https:" ? "wss:" : "ws:"
    const token = tokenRef.current
    const query = token ? `?token=${encodeURIComponent(token)}` : ""
    const socket = new WebSocket(`${protocol}//${location.host}/ws${query}`)
    socket.onopen = () => setConnected(true)
    socket.onclose = () => {
      setConnected(false)
      if (mountedRef.current) {
        reconnectTimer.current = setTimeout(connect, 3000)
      }
    }
    socket.onerror = () => {}
    socket.onmessage = (e) => {
      try {
        const event: TraceEvent = JSON.parse(e.data)
        setEvents((prev) => {
          const next = [...prev, event].slice(-MAX_EVENTS)
          persist(next)
          return next
        })
        // push 模式：直接在 WS 回调里分发 done/error
        const ev = event as any
        if (ev.type === "done" && ev.msgId) {
          onDoneRef.current(ev)
        } else if (ev.type === "error" && ev.msgId) {
          onErrorRef.current(ev)
        }
      } catch {
        // 忽略
      }
    }
    wsRef.current = socket
  }, [persist])

  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  const clearEvents = useCallback(() => {
    setEvents([])
    sessionStorage.removeItem(EVT_KEY)
  }, [])

  return { events, connected, clearEvents }
}
