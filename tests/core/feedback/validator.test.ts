import { describe, it, expect } from "vitest"
import { FeedbackValidator } from "../../../src/core/feedback/validator"

describe("FeedbackValidator", () => {
  it("reports passed when exit code 0", () => {
    const validator = new FeedbackValidator({ test: "npm test" })
    const report = validator.validate({
      success: true,
      stdout: "All tests passed",
      stderr: "",
      exitCode: 0,
    })
    expect(report.passed).toBe(true)
    expect(report.failures).toHaveLength(0)
  })

  it("reports failures when exit code non-zero", () => {
    const validator = new FeedbackValidator({ test: "npm test" })
    const report = validator.validate({
      success: false,
      stdout: "FAIL src/a.test.ts\n  AssertionError: expected 1 to be 2",
      stderr: "",
      exitCode: 1,
    })
    expect(report.passed).toBe(false)
    expect(report.failures.length).toBeGreaterThan(0)
    expect(report.category).toBe("test_failure")
  })

  it("extracts failure file and line", () => {
    const validator = new FeedbackValidator({ test: "npm test" })
    const report = validator.validate({
      success: false,
      stdout: "FAIL src/math.test.ts:12\n  expected 1 to be 2",
      stderr: "",
      exitCode: 1,
    })
    expect(report.failures[0].file).toBe("src/math.test.ts")
    expect(report.failures[0].line).toBe(12)
  })
})
