import {
  EmbedBuilder,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js'
import type { Command } from './Command.js'

export class HelpCommand implements Command {
  readonly data = new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all available commands.')

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🤖 Athena Commands')
      .setDescription(
        'Welcome to **Athena AI**! Here are the available commands:',
      )
      .addFields(
        {
          name: '🏓 /ping',
          value: 'Check if Athena is online.',
          inline: false,
        },
        {
          name: '📖 /help',
          value: 'Display all available commands.',
          inline: false,
        },
        {
          name: 'ℹ️ /about',
          value: 'Learn more about Athena AI.',
          inline: false,
        },
      )
      .setColor('Blurple')
      .setFooter({
        text: 'Athena AI • Version 0.1.0',
      })
      .setTimestamp()

    await interaction.reply({ embeds: [embed] })
  }
}
