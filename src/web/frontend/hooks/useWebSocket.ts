import { useEffect, useState, useCallback } from "react"
import type { TraceEvent } from "../../../core/types"

const EVT_KEY = "harness_events"
const MAX_EVENTS = 200

export function useWebSocket() {
  const [events, setEvents] = useState<TraceEvent[]>(() => {
    try { return JSON.parse(sessionStorage.getItem(EVT_KEY) ?? "[]") } catch { return [] }
  })
  const [connected, setConnected] = useState(false)

  const persist = useCallback((evs: TraceEvent[]) => {
    sessionStorage.setItem(EVT_KEY, JSON.stringify(evs.slice(-MAX_EVENTS)))
  }, [])

  useEffect(() => {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:"
    const socket = new WebSocket(`${protocol}//${location.host}/ws`)
    socket.onopen = () => setConnected(true)
    socket.onclose = () => setConnected(false)
    socket.onmessage = (e) => {
      const event: TraceEvent = JSON.parse(e.data)
      setEvents((prev) => {
        const next = [...prev, event]
        persist(next)
        return next
      })
    }
    return () => socket.close()
  }, [persist])

  const clearEvents = useCallback(() => {
    setEvents([])
    sessionStorage.removeItem(EVT_KEY)
  }, [])

  return { events, connected, clearEvents }
}
