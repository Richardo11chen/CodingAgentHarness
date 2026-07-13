import { describe, it, expect } from "vitest"
import { classifyFailure } from "../../../src/core/feedback/classifier"

describe("classifyFailure", () => {
  it("classifies syntax errors", () => {
    expect(classifyFailure("SyntaxError: unexpected token")).toBe("syntax_error")
    expect(classifyFailure("error TS1005: ';' expected")).toBe("syntax_error")
  })

  it("classifies test failures", () => {
    expect(classifyFailure("FAIL src/a.test.ts")).toBe("test_failure")
    expect(classifyFailure("AssertionError: expected 1 to be 2")).toBe("test_failure")
  })

  it("classifies type errors", () => {
    expect(classifyFailure("error TS2322: Type 'string' is not assignable")).toBe("type_error")
  })

  it("classifies lint violations", () => {
    expect(classifyFailure("error: 'x' is defined but never used")).toBe("lint_violation")
    expect(classifyFailure("eslint: no-unused-vars")).toBe("lint_violation")
  })

  it("returns unknown for unrecognized", () => {
    expect(classifyFailure("something weird happened")).toBe("unknown")
  })
})
