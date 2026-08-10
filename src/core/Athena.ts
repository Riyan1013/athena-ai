import { buildSystemPrompt } from '../ai/prompts/SystemPrompt.js'
import { determineResponseMode } from '../ai/response/ResponseStrategy.js'
import type { AIProvider } from '../ai/providers/AIProvider.js'
import type { Conversation } from '../conversation/Conversation.js'
import { ConversationManager } from '../conversation/ConversationManager.js'

const RESPONSE_TOKEN_LIMITS = {
  short: 220,
  normal: 500,
  detailed: 1000,
} as const

/**
 * Athena is the central AI assistant.
 *
 * Athena prepares prompts, manages conversation context,
 * determines the appropriate response depth, and delegates
 * response generation to the configured AI provider.
 */
export class Athena {
  constructor(
    private readonly provider: AIProvider,
    private readonly conversationManager: ConversationManager,
  ) {}

  /**
   * Sends a user message within a conversation and returns
   * Athena's response.
   */
  async ask(conversationId: string, message: string): Promise<string> {
    const conversation = this.conversationManager.getOrCreate(conversationId)

    conversation.addMessage('user', message)

    const prompt = this.buildPrompt(conversation)

    const responseMode = determineResponseMode(message)
    const maxOutputTokens = RESPONSE_TOKEN_LIMITS[responseMode]

    const response = await this.provider.generateResponse(
      prompt,
      maxOutputTokens,
    )

    conversation.addMessage('assistant', response)

    return response
  }

  /**
   * Builds the prompt sent to the AI provider using
   * Athena's system prompt and the current conversation history.
   */
  private buildPrompt(conversation: Conversation): string {
    const history = conversation
      .getMessages()
      .map((message) => {
        const role = message.role === 'user' ? 'User' : 'Athena'

        return `${role}:\n${message.content}`
      })
      .join('\n\n')

    return `
${buildSystemPrompt()}

Conversation:
${history}
`.trim()
  }
}
