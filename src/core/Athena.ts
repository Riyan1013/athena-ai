import { DiscordClient } from '../discord/DiscordClient.js'

// Top-level orchestrator. Owns and coordinates the app's services.
export class Athena {
  private readonly discord: DiscordClient

  constructor() {
    this.discord = new DiscordClient()
  }

  async start(): Promise<void> {
    await this.discord.start()
  }

  async stop(): Promise<void> {
    await this.discord.stop()
  }
}
