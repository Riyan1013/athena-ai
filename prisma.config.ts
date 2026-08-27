import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

/**
 * Prisma CLI configuration (Prisma 7+).

 */
export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
})
