import {
  EmbedBuilder,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js'
import type { Command } from './Command.js'

export class AboutCommand implements Command {
  readonly data = new SlashCommandBuilder()
    .setName('about')
    .setDescription('Learn more about Athena AI.')

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle(' Athena AI')
      .setDescription(
        'A modular AI assistant built with **TypeScript** and **Discord.js**.',
      )
      .addFields(
        {
          name: 'Version',
          value: 'v0.1.0',
          inline: true,
        },
        {
          name: ' Status',
          value: 'Development',
          inline: true,
        },
        {
          name: ' Developer',
          value: 'Riyan',
          inline: true,
        },
      )
      .setColor('Blurple')
      .setFooter({
        text: 'Athena AI • Your intelligent Discord assistant',
      })
      .setTimestamp()

    await interaction.reply({ embeds: [embed] })
  }
}
