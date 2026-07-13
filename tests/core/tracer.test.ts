import { describe, it, expect } from "vitest"
import { Tracer } from "../../src/core/tracer"
import type { TraceEvent } from "../../src/core/types"

describe("Tracer", () => {
  it("records and exports events", () => {
    const tracer = new Tracer()
    tracer.record({ type: "thinking", data: { text: "analyzing" } })
    tracer.record({ type: "action", data: { tool: "file_read" } })
    const events = tracer.export()
    expect(events).toHaveLength(2)
    expect(events[0].type).toBe("thinking")
    expect(events[1].type).toBe("action")
  })

  it("getActions returns only action events", () => {
    const tracer = new Tracer()
    tracer.record({ type: "thinking", data: {} })
    tracer.record({ type: "action", data: { tool: "file_read" } })
    tracer.record({ type: "action", data: { tool: "shell_exec" } })
    expect(tracer.getActions()).toHaveLength(2)
  })

  it("getDenials returns governance deny events", () => {
    const tracer = new Tracer()
    tracer.record({ type: "governance", data: { decision: "deny" } })
    tracer.record({ type: "governance", data: { decision: "allow" } })
    tracer.record({ type: "governance", data: { decision: "deny" } })
    expect(tracer.getDenials()).toHaveLength(2)
  })

  it("getFeedbackReports returns feedback events", () => {
    const tracer = new Tracer()
    tracer.record({ type: "feedback", data: { passed: false } })
    tracer.record({ type: "feedback", data: { passed: true } })
    expect(tracer.getFeedbackReports()).toHaveLength(2)
  })

  it("enforces max events in memory", () => {
    const tracer = new Tracer(3)
    tracer.record({ type: "thinking", data: { i: 1 } })
    tracer.record({ type: "thinking", data: { i: 2 } })
    tracer.record({ type: "thinking", data: { i: 3 } })
    tracer.record({ type: "thinking", data: { i: 4 } })
    expect(tracer.export()).toHaveLength(3)
  })
})
