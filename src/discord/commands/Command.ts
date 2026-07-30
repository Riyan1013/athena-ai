import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
} from 'discord.js'

// Contract every slash command must implement.
// `data` describes the command for Discord's REST API; `execute` runs it.
export interface Command {
  readonly data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder
  execute(interaction: ChatInputCommandInteraction): Promise<void>
}
