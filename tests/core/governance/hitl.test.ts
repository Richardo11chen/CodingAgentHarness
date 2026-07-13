import { describe, it, expect } from "vitest"
import { HitlStateMachine } from "../../../src/core/governance/hitl"
import { AgentState } from "../../../src/core/types"
import type { Action } from "../../../src/core/types"

const dangerousAction: Action = {
  type: "call_tool",
  tool: "shell_exec",
  args: { command: "git push --force" },
}

describe("HitlStateMachine", () => {
  it("starts in Running state", () => {
    const sm = new HitlStateMachine()
    expect(sm.getState()).toBe(AgentState.Running)
  })

  it("transitions to PendingApproval on requestApproval", () => {
    const sm = new HitlStateMachine()
    sm.requestApproval(dangerousAction)
    expect(sm.getState()).toBe(AgentState.PendingApproval)
  })

  it("returns action on approve", () => {
    const sm = new HitlStateMachine()
    sm.requestApproval(dangerousAction)
    const action = sm.approve()
    expect(action).toEqual(dangerousAction)
    expect(sm.getState()).toBe(AgentState.Running)
  })

  it("returns null on approve without pending", () => {
    const sm = new HitlStateMachine()
    expect(sm.approve()).toBeNull()
  })

  it("clears pending on deny", () => {
    const sm = new HitlStateMachine()
    sm.requestApproval(dangerousAction)
    sm.deny()
    expect(sm.getState()).toBe(AgentState.Running)
    expect(sm.getPendingAction()).toBeNull()
  })

  it("auto-denies on timeout", () => {
    const sm = new HitlStateMachine()
    sm.requestApproval(dangerousAction)
    sm.timeout()
    expect(sm.getState()).toBe(AgentState.Running)
  })

  it("transitions to Stopped on stop", () => {
    const sm = new HitlStateMachine()
    sm.stop()
    expect(sm.getState()).toBe(AgentState.Stopped)
  })

  it("ignores requestApproval when Stopped", () => {
    const sm = new HitlStateMachine()
    sm.stop()
    sm.requestApproval(dangerousAction)
    expect(sm.getState()).toBe(AgentState.Stopped)
  })
})
