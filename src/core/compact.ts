import type { LLMProvider } from "./llm.js"
import type { Message } from "./types.js"

export interface CompactOptions {
  keepRecent: number
  tokenLimit: number
}

export function estimateTokens(messages: Message[]): number {
  return messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0)
}

export async function compactContext(
  messages: Message[],
  llm: LLMProvider,
  options: CompactOptions
): Promise<Message[]> {
  const { keepRecent, tokenLimit } = options

  if (estimateTokens(messages) <= tokenLimit) {
    return messages
  }

  const system = messages.filter((m) => m.role === "system")
  const nonSystem = messages.filter((m) => m.role !== "system")

  const recent = nonSystem.slice(-keepRecent)
  const old = nonSystem.slice(0, -keepRecent)

  if (old.length === 0) {
    return messages
  }

  const summaryPrompt: Message[] = [
    ...system,
    {
      role: "user",
      content: `Summarize the following conversation, preserving key decisions, actions taken, and facts learned:\n\n${old.map((m) => `${m.role}: ${m.content}`).join("\n")}`,
    },
  ]

  const response = await llm.complete(summaryPrompt)
  const summaryMessage: Message = {
    role: "system",
    content: `[Conversation Summary]: ${response.text}`,
  }

  return [...system, summaryMessage, ...recent]
}
