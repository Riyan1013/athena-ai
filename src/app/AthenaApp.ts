import { GeminiProvider } from '../ai/providers/GeminiProvider.js'
import { ConversationManager } from '../conversation/ConversationManager.js'
import { Athena } from '../core/Athena.js'
import { DiscordClient } from '../discord/DiscordClient.js'
import { InMemoryMemoryRepository } from '../memory/InMemoryMemoryRepository.js'
import { MemoryManager } from '../memory/MemoryManager.js'

// Application bootstrapper.
// Responsible for starting and stopping Athena's interfaces.
export class AthenaApp {
  private readonly athena: Athena
  private readonly discord: DiscordClient

  constructor() {
    const provider = new GeminiProvider()
    const conversationManager = new ConversationManager()

    const memoryRepository = new InMemoryMemoryRepository()
    const memoryManager = new MemoryManager(memoryRepository)

    this.athena = new Athena(provider, conversationManager, memoryManager)

    this.discord = new DiscordClient(this.athena)
  }

  async start(): Promise<void> {
    await this.discord.start()
  }

  stop(): void {
    this.discord.stop()
  }
}
