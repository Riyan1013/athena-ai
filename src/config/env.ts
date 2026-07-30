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
  // Features that require these should check for their existence.
  GEMINI_API_KEY: z.string().optional(),
  DISCORD_TOKEN: z.string().optional(),
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
