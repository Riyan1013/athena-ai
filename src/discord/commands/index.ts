import type { Command } from './Command.js'
import { PingCommand } from './PingCommand.js'
import { HelpCommand } from './HelpCommand.js'
import { AboutCommand } from './AboutCommand.js'
import { AskCommand } from './AskCommand.js'
import { RememberCommand } from './RememberCommand.js'
import type { Athena } from '../../core/Athena.js'
import { MemoriesCommand } from './MemoriesCommand.js'
import { ForgetCommand } from './ForgetCommand.js'

// Single place to add new commands — CommandHandler reads from this list.
// Athena is only passed to commands that actually need it.
export function createCommands(athena: Athena): Command[] {
  return [
    new PingCommand(),
    new HelpCommand(),
    new AboutCommand(),
    new AskCommand(athena),
    new RememberCommand(athena),
    new MemoriesCommand(athena),
    new ForgetCommand(athena),
  ]
}
