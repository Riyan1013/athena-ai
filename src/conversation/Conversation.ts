export type ConversationRole = 'user' | 'assistant'

export interface ConversationMessage {
  role: ConversationRole
  content: string
  timestamp: number
}

/**
 * Represents a single ongoing conversation with Athena.
 *
 * A conversation contains the ordered messages exchanged
 * between the user and Athena.
 */
export class Conversation {
  readonly id: string
  private readonly messages: ConversationMessage[] = []

  constructor(id: string) {
    this.id = id
  }

  addMessage(role: ConversationRole, content: string): void {
    this.messages.push({
      role,
      content,
      timestamp: Date.now(),
    })
  }

  getMessages(): readonly ConversationMessage[] {
    return this.messages
  }

  clear(): void {
    this.messages.length = 0
  }
}
