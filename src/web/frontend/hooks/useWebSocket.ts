import { useEffect, useState, useCallback } from "react"
import type { TraceEvent } from "../../../core/types"

export function useWebSocket() {
  const [events, setEvents] = useState<TraceEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [ws, setWs] = useState<WebSocket | null>(null)

  useEffect(() => {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:"
    const socket = new WebSocket(`${protocol}//${location.host}/ws`)
    socket.onopen = () => setConnected(true)
    socket.onclose = () => setConnected(false)
    socket.onmessage = (e) => {
      const event: TraceEvent = JSON.parse(e.data)
      setEvents((prev) => [...prev, event])
    }
    setWs(socket)
    return () => socket.close()
  }, [])

  const clearEvents = useCallback(() => setEvents([]), [])
  return { events, connected, clearEvents }
}
