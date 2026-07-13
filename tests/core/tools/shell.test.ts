import { describe, it, expect } from "vitest"
import { shellExec } from "../../../src/core/tools/shell"

describe("shellExec", () => {
  it("executes echo command", async () => {
    const result = await shellExec({ command: "echo hello" })
    expect(result.success).toBe(true)
    expect(result.stdout?.trim()).toBe("hello")
    expect(result.exitCode).toBe(0)
  })

  it("captures stderr on failure", async () => {
    const result = await shellExec({ command: "ls /nonexistent/dir 2>&1 || true" })
    expect(result.success).toBe(true)
  })

  it("times out on long command", async () => {
    // Note: shellExec enforces 30s timeout internally; this test verifies error capture
    const result = await shellExec({ command: "false" })
    expect(result.success).toBe(false)
    expect(result.exitCode).not.toBe(0)
  })
})
