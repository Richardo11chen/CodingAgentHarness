import { useEffect, useState, useCallback, useRef } from "react"
import type { TraceEvent } from "../../../core/types"

const EVT_KEY = "harness_events"
const MAX_EVENTS = 200

export function useWebSocket() {
  const [events, setEvents] = useState<TraceEvent[]>(() => {
    try { return JSON.parse(sessionStorage.getItem(EVT_KEY) ?? "[]") } catch { return [] }
  })
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>()
  const mountedRef = useRef(true)
  const tokenRef = useRef<string>("")

  const persist = useCallback((evs: TraceEvent[]) => {
    sessionStorage.setItem(EVT_KEY, JSON.stringify(evs.slice(-MAX_EVENTS)))
  }, [])

  const connect = useCallback(() => {
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
    socket.onerror = () => {
      socket.close()
    }
    socket.onmessage = (e) => {
      try {
        const event: TraceEvent = JSON.parse(e.data)
        setEvents((prev) => {
          const next = [...prev, event].slice(-MAX_EVENTS)
          persist(next)
          return next
        })
      } catch {
        // 忽略无法解析的消息
      }
    }
    wsRef.current = socket
  }, [persist])

  useEffect(() => {
    fetch("/api/auth-token")
      .then(r => r.json())
      .then(d => { tokenRef.current = d.token })
      .catch(() => {})
      .finally(() => connect())
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
