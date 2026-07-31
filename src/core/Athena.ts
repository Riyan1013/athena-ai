import { buildSystemPrompt } from '../ai/prompts/SystemPrompt.js'
import type { AIProvider } from '../ai/providers/AIProvider.js'

/**
 * Athena is the central AI assistant.
 *
 * Athena prepares prompts and delegates response generation
 * to the configured AI provider.
 */
export class Athena {
  constructor(private readonly provider: AIProvider) {}

  /**
   * Sends a user message to the configured AI provider
   * and returns Athena's response.
   */
  async ask(message: string): Promise<string> {
    const prompt = `
${buildSystemPrompt()}

User:
${message}
`.trim()

    return this.provider.generateResponse(prompt)
  }
}
