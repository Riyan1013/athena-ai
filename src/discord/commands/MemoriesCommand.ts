import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js'

import type { Athena } from '../../core/Athena.js'
import type { Command } from './Command.js'

/**
 * Bridges Discord interactions to Athena's long-term memory API.
 *
 * This command contains no memory business logic. It simply asks
 * Athena what the requesting user's stored memories are and formats
 * them for display — retrieval, ownership scoping, and filtering to
 * EXPLICIT memories all remain Athena's (and MemoryManager's)
 * responsibility.
 */
export class MemoriesCommand implements Command {
  readonly data = new SlashCommandBuilder()
    .setName('memories')
    .setDescription('Show what Athena remembers about me.')

  constructor(private readonly athena: Athena) {}

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const athenaUserId = interaction.user.id

    try {
      const memories = await this.athena.listMemories(athenaUserId)

      if (memories.length === 0) {
        await interaction.reply(
          "🧠 I don't have any saved memories for you yet.",
        )
        return
      }

      const lines = memories.map((memory, index) => {
        const shortId = memory.id.slice(0, 8)
        return `${index + 1}. ${memory.content}\n   \`id: ${shortId}\``
      })

      await interaction.reply(
        `🧠 Here's what I remember about you:\n\n${lines.join('\n')}`,
      )
    } catch (error) {
      console.error(
        `Failed to list memories for athenaUserId "${athenaUserId}":`,
        error,
      )

      await interaction.reply(
        "Sorry, I wasn't able to retrieve your memories. Please try again.",
      )
    }
  }
}
