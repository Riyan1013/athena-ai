import type { Command } from './Command.js'
import { PingCommand } from './PingCommand.js'
import { HelpCommand } from './HelpCommand.js'
import { AboutCommand } from './AboutCommand.js'
import { AskCommand } from './AskCommand.js'
import type { Athena } from '../../core/Athena.js'

// Single place to add new commands — CommandHandler reads from this list.
// Athena is only passed to commands that actually need it (e.g. AskCommand).
export function createCommands(athena: Athena): Command[] {
  return [
    new PingCommand(),
    new HelpCommand(),
    new AboutCommand(),
    new AskCommand(athena),
  ]
}
