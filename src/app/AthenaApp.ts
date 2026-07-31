import { GeminiProvider } from '../ai/providers/GeminiProvider.js'
import { Athena } from '../core/Athena.js'
import { DiscordClient } from '../discord/DiscordClient.js'

// Application bootstrapper.
// Responsible for starting and stopping Athena's interfaces.
export class AthenaApp {
  private readonly athena: Athena
  private readonly discord: DiscordClient

  constructor() {
    const provider = new GeminiProvider()

    this.athena = new Athena(provider)

    this.discord = new DiscordClient()
  }

  async start(): Promise<void> {
    await this.discord.start()
  }

  async stop(): Promise<void> {
    await this.discord.stop()
  }
}
