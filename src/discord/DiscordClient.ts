import { Client, Events, GatewayIntentBits } from 'discord.js'
import { env } from '../config/env.js'
import { CommandHandler } from './CommandHandler.js'
import type { Athena } from '../core/Athena.js'

// Wraps discord.js and owns all Discord-specific concerns: login, lifecycle,
// and event wiring. Command execution itself lives in CommandHandler.
export class DiscordClient {
  private readonly client: Client
  private readonly commandHandler: CommandHandler

  constructor(athena: Athena) {
    // Minimal intents for now — expand once message handling is added.
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds],
    })

    // Commands need a way to call back into Athena (e.g. AskCommand), so the
    // reference is passed down rather than commands reaching into Discord internals.
    this.commandHandler = new CommandHandler(athena)
    this.registerEvents()
  }

  private registerEvents(): void {
    this.client.once(Events.ClientReady, async (readyClient) => {
      console.log(`Bot logged in as ${readyClient.user.tag}`)

      // Register slash commands automatically once we know the app's ID.
      await this.commandHandler.registerCommands(readyClient.application.id)
    })

    this.client.on(Events.InteractionCreate, (interaction) => {
      void this.commandHandler.handleInteraction(interaction)
    })
  }

  async start(): Promise<void> {
    if (!env.DISCORD_TOKEN) {
      throw new Error(
        'DISCORD_TOKEN is not set. Cannot start the Discord client.',
      )
    }

    try {
      await this.client.login(env.DISCORD_TOKEN)
    } catch (error) {
      throw new Error(
        `Failed to log in to Discord: ${(error as Error).message}`,
      )
    }
  }

  stop(): void {
    this.client.destroy()
  }
}
