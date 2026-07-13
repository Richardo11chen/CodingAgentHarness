import { readFileSync, existsSync } from "node:fs"
import { parse } from "yaml"
import { resolve, relative, isAbsolute } from "node:path"
import type { Action, GuardrailDecision, Policy } from "../types.js"

export class PolicyEngine {
  private policies: Policy[]

  constructor(policies: Policy[]) {
    this.policies = policies
  }

  static fromYaml(path: string): PolicyEngine {
    if (!existsSync(path)) return new PolicyEngine([])
    const raw = readFileSync(path, "utf-8")
    const parsed = parse(raw)
    return new PolicyEngine(parsed.rules ?? [])
  }

  evaluate(action: Action): { decision: GuardrailDecision; policy?: Policy } {
    for (const policy of this.policies) {
      if (this.matchPolicy(policy, action)) {
        return { decision: policy.decision, policy }
      }
    }
    return { decision: "allow" }
  }

  private matchPolicy(policy: Policy, action: Action): boolean {
    if (policy.type === "command_pattern") {
      const cmd = action.args?.command ?? ""
      return new RegExp(policy.pattern).test(cmd)
    }
    if (policy.type === "path_pattern") {
      const path = action.args?.path ?? ""
      return this.globMatch(policy.pattern, path)
    }
    if (policy.type === "path_boundary") {
      const path = action.args?.path ?? ""
      if (!path) return false
      const resolved = resolve(path)
      const boundary = resolve(policy.pattern)
      const rel = relative(boundary, resolved)
      return rel.startsWith("..") || isAbsolute(rel)
    }
    return false
  }

  private globMatch(pattern: string, path: string): boolean {
    let regexStr = pattern
      .replace(/\*\*\//g, "\x00GLOBSTAR_SLASH\x00")
      .replace(/\*\*/g, "\x00GLOBSTAR\x00")
      .replace(/\*/g, "\x00STAR\x00")
      .replace(/\?/g, "\x00QUESTION\x00")
    regexStr = regexStr.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    regexStr = regexStr
      .replace(/\x00GLOBSTAR_SLASH\x00/g, "(.*/)?")
      .replace(/\x00GLOBSTAR\x00/g, ".*")
      .replace(/\x00STAR\x00/g, "[^/]*")
      .replace(/\x00QUESTION\x00/g, ".")
    return new RegExp(`^${regexStr}$`).test(path)
  }
}
