import type { FailureCategory } from "../types.js"

export function classifyFailure(output: string): FailureCategory {
  const lower = output.toLowerCase()
  if (lower.includes("syntaxerror") || lower.includes("ts1005") || lower.includes("syntax error")) {
    return "syntax_error"
  }
  if (lower.includes("ts2322") || lower.includes("type '") || lower.includes("is not assignable")) {
    return "type_error"
  }
  if (lower.includes("eslint") || lower.includes("no-unused") || lower.includes("defined but never used")) {
    return "lint_violation"
  }
  if (lower.includes("fail") || lower.includes("assertion") || lower.includes("expected") && lower.includes("to be")) {
    return "test_failure"
  }
  return "unknown"
}
