import { buildSystemPrompt } from '../ai/prompts/SystemPrompt.js'
import { determineResponseMode } from '../ai/response/ResponseStrategy.js'
import type { AIProvider } from '../ai/providers/AIProvider.js'
import type { Conversation } from '../conversation/Conversation.js'
import { ConversationManager } from '../conversation/ConversationManager.js'
import type { AthenaUserId } from '../memory/Memory.js'

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
   *
   * `athenaUserId` identifies who the message is from at the Athena
   * platform level (see src/memory/Memory.ts). It is accepted here to
   * establish Athena's user-identity input boundary; it is not yet used
   * for memory retrieval or prompt construction.
   */
  async ask(
    conversationId: string,
    athenaUserId: AthenaUserId,
    message: string,
  ): Promise<string> {
    const conversation = this.conversationManager.getOrCreate(conversationId)

    // The pending user message is included when building the prompt, but
    // is only committed to the conversation after the provider succeeds —
    // a failed request must not leave a half-completed turn behind.
    const prompt = this.buildPrompt(conversation, message)

    const responseMode = determineResponseMode(message)
    const maxOutputTokens = RESPONSE_TOKEN_LIMITS[responseMode]

    const response = await this.provider.generateResponse(
      prompt,
      maxOutputTokens,
    )

    conversation.addMessage('user', message)
    conversation.addMessage('assistant', response)

    return response
  }

  /**
   * Builds the prompt sent to the AI provider using Athena's system prompt,
   * the conversation history so far, and the current (not yet stored)
   * user message.
   */
  private buildPrompt(
    conversation: Conversation,
    currentMessage: string,
  ): string {
    const messages = [
      ...conversation.getMessages(),
      { role: 'user' as const, content: currentMessage },
    ]

    const history = messages
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
