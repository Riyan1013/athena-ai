import { Collection, REST, Routes, type Interaction } from 'discord.js'
import { env } from '../config/env.js'
import type { Command } from './commands/Command.js'
import { createCommands } from './commands/index.js'
import type { Athena } from '../core/Athena.js'
import { AIProviderError } from '../ai/providers/AIProviderError.js'

// Owns registration of slash commands with Discord and routing of
// InteractionCreate events to the matching Command implementation.
export class CommandHandler {
  private readonly commands = new Collection<string, Command>()
  private readonly rest: REST

  constructor(athena: Athena) {
    // Athena is only forwarded to the commands that need it (e.g. AskCommand).
    for (const command of createCommands(athena)) {
      this.commands.set(command.data.name, command)
    }

    // DISCORD_TOKEN is validated as present before DiscordClient.start() runs,
    // so it's safe to use here.
    this.rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN)
  }

  // Registers all known commands as global application commands.
  async registerCommands(applicationId: string): Promise<void> {
    const body = this.commands.map((command) => command.data.toJSON())

    await this.rest.put(Routes.applicationCommands(applicationId), { body })
    console.log(`Registered ${body.length} slash command(s).`)
  }

  // Routes an interaction to its command, if one matches.
  async handleInteraction(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return

    const command = this.commands.get(interaction.commandName)
    if (!command) return

    try {
      await command.execute(interaction)
    } catch (error) {
      console.error(
        `Error executing command "${interaction.commandName}":`,
        error,
      )

      const errorResponse = {
        content: this.buildErrorMessage(error),
        ephemeral: true,
      }

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorResponse)
      } else {
        await interaction.reply(errorResponse)
      }
    }
  }

  // Produces a provider-independent, user-facing message for a command
  // failure. AIProviderError gets a message tailored to its code; anything
  // else falls back to the generic message.
  private buildErrorMessage(error: unknown): string {
    if (!(error instanceof AIProviderError)) {
      return 'There was an error executing this command.'
    }

    switch (error.code) {
      case 'RATE_LIMITED':
        return error.retryAfterSeconds
          ? `🦉 Athena is temporarily rate-limited. Please try again in about ${error.retryAfterSeconds} seconds.`
          : '🦉 Athena is temporarily rate-limited. Please try again shortly.'
      case 'MODEL_UNAVAILABLE':
        return "🦉 Athena's current AI model is temporarily unavailable."
      case 'AUTHENTICATION':
        return '🦉 Athena is having trouble authenticating with the AI provider.'
      case 'NETWORK':
        return '🦉 Athena could not reach the AI provider. Please try again shortly.'
      case 'INVALID_REQUEST':
        return '🦉 Athena could not process that request.'
      default:
        return '🦉 Athena encountered an unexpected AI provider error.'
    }
  }
}
