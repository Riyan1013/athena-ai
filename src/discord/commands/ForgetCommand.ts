import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js'

import type { Athena } from '../../core/Athena.js'
import type { Command } from './Command.js'

/**
 * Bridges Discord interactions to Athena's long-term memory API.
 *
 * This command contains no memory business logic. It resolves a
 * user-supplied ID prefix to a full memory ID by matching against that
 * same user's own memories (as returned by Athena.listMemories(), which
 * is already scoped to the requesting user), then delegates the actual
 * deletion — including the final ownership check — to Athena.forget().
 * It never accesses MemoryManager or the repository directly.
 */
export class ForgetCommand implements Command {
  readonly data = new SlashCommandBuilder()
    .setName('forget')
    .setDescription('Forget a specific memory.')
    .addStringOption((option) =>
      option
        .setName('id')
        .setDescription('The memory ID (or the start of it) to forget.')
        .setRequired(true),
    )

  constructor(private readonly athena: Athena) {}

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const athenaUserId = interaction.user.id
    const idPrefix = interaction.options.getString('id', true)

    try {
      // listMemories() is already scoped to athenaUserId, so matching
      // happens only against memories this user owns — another user's
      // memory can never appear here, let alone be matched or deleted.
      const memories = await this.athena.listMemories(athenaUserId)
      const matches = memories.filter((memory) =>
        memory.id.startsWith(idPrefix),
      )

      if (matches.length === 0) {
        await interaction.reply(
          `🧠 I couldn't find a memory matching \`${idPrefix}\`.`,
        )
        return
      }

      if (matches.length > 1) {
        await interaction.reply(
          `🧠 That ID matches more than one memory. Please use a longer ID to narrow it down.`,
        )
        return
      }

      const [memory] = matches
      const forgotten = await this.athena.forget(athenaUserId, memory.id)

      if (!forgotten) {
        await interaction.reply(
          `🧠 I couldn't find a memory matching \`${idPrefix}\`.`,
        )
        return
      }

      await interaction.reply(`🧠 Forgotten: "${memory.content}"`)
    } catch (error) {
      console.error(
        `Failed to forget memory for athenaUserId "${athenaUserId}":`,
        error,
      )

      await interaction.reply(
        "Sorry, I wasn't able to forget that. Please try again.",
      )
    }
  }
}
