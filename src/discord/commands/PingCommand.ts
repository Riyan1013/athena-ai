import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js'
import type { Command } from './Command.js'

export class PingCommand implements Command {
  readonly data = new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check if Athena is online.')

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply('🏓 Pong!')
  }
}
