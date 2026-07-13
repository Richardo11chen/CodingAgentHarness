import { describe, it, expect } from "vitest"
import { runTest } from "../../../src/core/tools/test-runner"

describe("runTest", () => {
  it("detects passing tests", async () => {
    const result = await runTest({ command: "echo 'All tests passed'" })
    expect(result.success).toBe(true)
  })

  it("detects failing tests", async () => {
    const result = await runTest({ command: "echo 'FAIL' && exit 1" })
    expect(result.success).toBe(false)
    expect(result.exitCode).toBe(1)
  })
})
