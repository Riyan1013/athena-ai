import { Collection, REST, Routes, type Interaction } from 'discord.js'
import { env } from '../config/env.js'
import type { Command } from './commands/Command.js'
import { commands } from './commands/index.js'

// Owns registration of slash commands with Discord and routing of
// InteractionCreate events to the matching Command implementation.
export class CommandHandler {
  private readonly commands = new Collection<string, Command>()
  private readonly rest: REST

  constructor() {
    for (const command of commands) {
      this.commands.set(command.data.name, command)
    }

    this.rest = new REST({ version: '10' }).setToken(
      env.DISCORD_TOKEN as string,
    )
  }

  // Registers all known commands as GUILD application commands.
  async registerCommands(applicationId: string): Promise<void> {
    const body = commands.map((command) => command.data.toJSON())

    await this.rest.put(
      Routes.applicationGuildCommands(
        applicationId,
        env.DISCORD_GUILD_ID as string,
      ),
      { body },
    )

    console.log(` Registered ${body.length} guild command(s).`)
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
        content: 'There was an error executing this command.',
        ephemeral: true,
      }

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorResponse)
      } else {
        await interaction.reply(errorResponse)
      }
    }
  }
}
