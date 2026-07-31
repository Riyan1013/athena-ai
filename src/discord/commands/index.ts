import type { Command } from './Command.js'
import { PingCommand } from './PingCommand.js'
import { HelpCommand } from './HelpCommand.js'
import { AboutCommand } from './AboutCommand.js'

// Single place to add new commands — CommandHandler reads from this list.
export const commands: Command[] = [
  new PingCommand(),
  new HelpCommand(),
  new AboutCommand(),
]
