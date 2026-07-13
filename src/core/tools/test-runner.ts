import { execSync } from "node:child_process"
import type { ToolArgs, ToolResult } from "../types.js"
import type { Tool } from "./file.js"

export const runTest: Tool = async (args) => {
  try {
    if (!args.command) return { success: false, error: "command required" }
    const stdout = execSync(args.command, {
      timeout: 300000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })
    return { success: true, stdout, stderr: "", exitCode: 0 }
  } catch (e: any) {
    return {
      success: false,
      error: String(e.message ?? e),
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
      exitCode: e.status ?? 1,
    }
  }
}
