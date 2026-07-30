import 'dotenv/config'
import { z } from 'zod'

// The single source of truth for Athena's environment variables.
// No other module should access process.env directly.
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error'])
    .default('info'),

  // Optional for now.
  GEMINI_API_KEY: z.string().optional(), // We'll need this later

  DISCORD_TOKEN: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1),
})

// Validate environment variables.
const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:')
  console.error(parsed.error.format())
  process.exit(1)
}

// Typed and validated environment configuration.
export const env = parsed.data
