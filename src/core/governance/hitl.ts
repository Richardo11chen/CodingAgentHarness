import { AgentState } from "../types.js"
import type { Action } from "../types.js"

export class HitlStateMachine {
  private state: AgentState = AgentState.Running
  private pendingAction: Action | null = null

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

  approve(): Action | null {
    if (this.state !== AgentState.PendingApproval) return null
    const action = this.pendingAction
    this.pendingAction = null
    this.state = AgentState.Running
    return action
  }

  deny(): void {
    if (this.state !== AgentState.PendingApproval) return
    this.pendingAction = null
    this.state = AgentState.Running
  }

  timeout(): void {
    this.deny()
  }

  stop(): void {
    this.state = AgentState.Stopped
    this.pendingAction = null
  }
}
