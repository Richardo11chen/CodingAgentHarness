import { resolve, relative, isAbsolute } from "node:path"
import type { ToolArgs, ToolResult } from "../types.js"
import type { Tool } from "../tools/file.js"

export interface SandboxLimits {
  timeout: number
  maxMemory: number
}

export class Sandbox {
  private projectDir: string
  private limits: SandboxLimits

  constructor(projectDir: string, limits: SandboxLimits) {
    this.projectDir = resolve(projectDir)
    this.limits = limits
  }

  async run(tool: Tool, args: ToolArgs): Promise<ToolResult> {
    const resolvedArgs = { ...args }
    if (args.path) {
      const resolved = resolve(this.projectDir, args.path)
      if (!this.isPathAllowed(resolved)) {
        return { success: false, error: `path outside project directory: ${args.path}` }
      }
      resolvedArgs.path = resolved
    }
    return tool(resolvedArgs)
  }

  private isPathAllowed(resolved: string): boolean {
    const rel = relative(this.projectDir, resolved)
    return !rel.startsWith("..") && !isAbsolute(rel)
  }

  getProjectDir(): string {
    return this.projectDir
  }

  getLimits(): SandboxLimits {
    return this.limits
  }
}
