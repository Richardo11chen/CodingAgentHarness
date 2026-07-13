import type { ToolResult, FeedbackReport, Failure } from "../types.js"
import { classifyFailure } from "./classifier.js"

export interface SensorConfig {
  test: string
  lint?: string
  typecheck?: string
}

export class FeedbackValidator {
  private sensors: SensorConfig

  constructor(sensors: SensorConfig) {
    this.sensors = sensors
  }

  validate(result: ToolResult): FeedbackReport {
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`
    if (result.success && (result.exitCode === 0 || result.exitCode === undefined)) {
      return { passed: true, failures: [], category: "unknown", rawOutput: output }
    }
    const failures = this.extractFailures(output)
    const category = classifyFailure(output)
    return { passed: false, failures, category, rawOutput: output }
  }

  private extractFailures(output: string): Failure[] {
    const failures: Failure[] = []
    const lines = output.split("\n")
    for (const line of lines) {
      const match = line.match(/(?:FAIL|✕|×)\s+(.+?):(\d+)/)
      if (match) {
        failures.push({ message: line, file: match[1], line: parseInt(match[2], 10) })
      }
    }
    if (failures.length === 0 && output.trim()) {
      failures.push({ message: output.trim().slice(0, 200) })
    }
    return failures
  }
}
