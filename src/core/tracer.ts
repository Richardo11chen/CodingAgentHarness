import type { TraceEvent, TraceEventType } from "./types.js"

export class Tracer {
  private events: TraceEvent[] = []
  private maxEvents: number
  private onEvent?: (event: TraceEvent) => void

  constructor(maxEvents = 500, onEvent?: (event: TraceEvent) => void) {
    this.maxEvents = maxEvents
    this.onEvent = onEvent
  }

  record(event: Omit<TraceEvent, "timestamp">): void {
    const full: TraceEvent = { ...event, timestamp: Date.now() }
    this.events.push(full)
    if (this.events.length > this.maxEvents) {
      this.events.shift()
    }
    this.onEvent?.(full)
  }

  export(): TraceEvent[] {
    return [...this.events]
  }

  getActions(): TraceEvent[] {
    return this.events.filter((e) => e.type === "action")
  }

  getDenials(): TraceEvent[] {
    return this.events.filter(
      (e) => e.type === "governance" && (e.data as any).decision === "deny"
    )
  }

  getFeedbackReports(): TraceEvent[] {
    return this.events.filter((e) => e.type === "feedback")
  }

  flush(path: string): void {
    // In production: write to file. For now, no-op (tests use export())
  }
}
