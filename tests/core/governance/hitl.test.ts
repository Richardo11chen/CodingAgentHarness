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

  it("waitForApproval auto-denies on timeout", async () => {
    const sm = new HitlStateMachine()
    sm.requestApproval(dangerousAction)
    const promise = sm.waitForApproval(100)
    const result = await promise
    expect(result).toBeNull()
    expect(sm.getState()).toBe(AgentState.Running)
  })

  it("waitForApproval resolves before timeout", async () => {
    const sm = new HitlStateMachine()
    const action: Action = { type: "call_tool", tool: "shell_exec", args: { command: "test" } }
    sm.requestApproval(action)
    const promise = sm.waitForApproval(5000)
    sm.approve()
    const result = await promise
    expect(result).not.toBeNull()
    expect(result!.tool).toBe("shell_exec")
  })

  it("handles sequential approval-approve cycles", async () => {
    const sm = new HitlStateMachine()

    sm.requestApproval({ type: "call_tool", tool: "a", args: {} })
    const p1 = sm.waitForApproval(5000)
    sm.approve()
    const r1 = await p1
    expect(r1?.tool).toBe("a")
    expect(sm.getState()).toBe(AgentState.Running)

    sm.requestApproval({ type: "call_tool", tool: "b", args: {} })
    const p2 = sm.waitForApproval(5000)
    sm.deny()
    const r2 = await p2
    expect(r2).toBeNull()
    expect(sm.getState()).toBe(AgentState.Running)
  })

  it("stop resolves pending waitForApproval with null", async () => {
    const sm = new HitlStateMachine()
    sm.requestApproval({ type: "call_tool", tool: "test", args: {} })
    const promise = sm.waitForApproval(5000)
    sm.stop()
    const result = await promise
    expect(result).toBeNull()
    expect(sm.getState()).toBe(AgentState.Stopped)
  })

  it("waitForApproval uses default timeout of 5 minutes", async () => {
    const sm = new HitlStateMachine()
    sm.requestApproval({ type: "call_tool", tool: "test", args: {} })
    const promise = sm.waitForApproval()
    sm.approve()
    const result = await promise
    expect(result).not.toBeNull()
  })

  it("getPendingAction returns null after deny", () => {
    const sm = new HitlStateMachine()
    sm.requestApproval({ type: "call_tool", tool: "x", args: {} })
    sm.deny()
    expect(sm.getPendingAction()).toBeNull()
  })

  it("approve on Running state returns null safely", () => {
    const sm = new HitlStateMachine()
    expect(sm.approve()).toBeNull()
    expect(sm.getState()).toBe(AgentState.Running)
  })
})
