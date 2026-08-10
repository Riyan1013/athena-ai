import { Conversation } from './Conversation.js'

/**
 * Manages active Athena conversations in memory.
 *
 * Persistence will be introduced later as part of
 * Athena's memory system.
 */
export class ConversationManager {
  private readonly conversations = new Map<string, Conversation>()

  getOrCreate(conversationId: string): Conversation {
    let conversation = this.conversations.get(conversationId)

    if (!conversation) {
      conversation = new Conversation(conversationId)
      this.conversations.set(conversationId, conversation)
    }

    return conversation
  }

  get(conversationId: string): Conversation | undefined {
    return this.conversations.get(conversationId)
  }

  delete(conversationId: string): boolean {
    return this.conversations.delete(conversationId)
  }

  clear(conversationId: string): boolean {
    const conversation = this.conversations.get(conversationId)

    if (!conversation) {
      return false
    }

    conversation.clear()
    return true
  }
}
