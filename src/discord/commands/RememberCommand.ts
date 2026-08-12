import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js'

import type { Athena } from '../../core/Athena.js'
import type { Command } from './Command.js'

/**
 * Bridges Discord interactions to Athena's long-term memory API.
 *
 * This command contains no memory business logic. It simply forwards
 * the user's explicit "remember this" request to Athena and reports
 * whether it succeeded. Ownership, storage, and validation all remain
 * Athena's (and, beneath it, MemoryManager's) responsibility.
 */
export class RememberCommand implements Command {
  readonly data = new SlashCommandBuilder()
    .setName('remember')
    .setDescription('Remember something about me.')
    .addStringOption((option) =>
      option
        .setName('content')
        .setDescription('Something you want Athena to remember.')
        .setRequired(true),
    )

  constructor(private readonly athena: Athena) {}

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const content = interaction.options.getString('content', true)
    const athenaUserId = interaction.user.id

    try {
      await this.athena.remember(athenaUserId, content)

      await interaction.reply("Got it — I'll remember that.")
    } catch (error) {
      console.error(
        `Failed to remember content for athenaUserId "${athenaUserId}":`,
        error,
      )

      await interaction.reply(
        "Sorry, I wasn't able to remember that. Please try again.",
      )
    }
  }
}
