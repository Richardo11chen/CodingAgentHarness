import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs"
import type { ToolArgs, ToolResult } from "../types.js"

export type Tool = (args: ToolArgs) => Promise<ToolResult>

export const fileRead: Tool = async (args) => {
  try {
    if (!args.path) return { success: false, error: "path required" }
    if (!existsSync(args.path)) return { success: false, error: `file not found: ${args.path}` }
    const content = readFileSync(args.path, "utf-8")
    return { success: true, content }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export const fileWrite: Tool = async (args) => {
  try {
    if (!args.path) return { success: false, error: "path required" }
    if (args.content === undefined) return { success: false, error: "content required" }
    writeFileSync(args.path, args.content)
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export const fileDelete: Tool = async (args) => {
  try {
    if (!args.path) return { success: false, error: "path required" }
    if (!existsSync(args.path)) return { success: false, error: `file not found: ${args.path}` }
    unlinkSync(args.path)
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}
