import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js'

import type { Athena } from '../../core/Athena.js'
import { splitMessage } from '../utils/MessageSplitter.js'
import type { Command } from './Command.js'

/**
 * Bridges Discord interactions to Athena.
 *
 * This command contains no AI logic.
 * It simply forwards the user's question to Athena
 * and returns the generated response.
 */
export class AskCommand implements Command {
  readonly data = new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask Athena a question.')
    .addStringOption((option) =>
      option
        .setName('question')
        .setDescription('The question you want to ask Athena.')
        .setRequired(true),
    )

  constructor(private readonly athena: Athena) {}

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const question = interaction.options.getString('question', true)

    // AI responses may take longer than Discord's initial response window.
    await interaction.deferReply()

    const guildId = interaction.guildId ?? 'dm'
    const channelId = interaction.channelId
    const userId = interaction.user.id

    const conversationId = `${guildId}:${channelId}:${userId}`

    const answer = await this.athena.ask(conversationId, question)

    const [first, ...rest] = splitMessage(answer)

    await interaction.editReply(first)

    for (const chunk of rest) {
      await interaction.followUp(chunk)
    }
  }
}
