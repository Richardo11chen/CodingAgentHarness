import { AgentState } from "../types.js"
import type { Action } from "../types.js"

export class HitlStateMachine {
  private state: AgentState = AgentState.Running
  private pendingAction: Action | null = null
  private approvalResolver: ((action: Action | null) => void) | null = null

  getState(): AgentState {
    return this.state
  }

  getPendingAction(): Action | null {
    return this.pendingAction
  }

  requestApproval(action: Action): void {
    if (this.state === AgentState.Stopped) return
    this.state = AgentState.PendingApproval
    this.pendingAction = action
  }

  waitForApproval(): Promise<Action | null> {
    return new Promise((resolve) => {
      this.approvalResolver = resolve
    })
  }

  approve(): Action | null {
    if (this.state !== AgentState.PendingApproval) return null
    const action = this.pendingAction
    this.pendingAction = null
    this.state = AgentState.Running
    this.approvalResolver?.(action)
    this.approvalResolver = null
    return action
  }

  deny(): void {
    if (this.state !== AgentState.PendingApproval) return
    this.pendingAction = null
    this.state = AgentState.Running
    this.approvalResolver?.(null)
    this.approvalResolver = null
  }

  timeout(): void {
    this.deny()
  }

  stop(): void {
    this.state = AgentState.Stopped
    this.pendingAction = null
    this.approvalResolver?.(null)
    this.approvalResolver = null
  }
}
