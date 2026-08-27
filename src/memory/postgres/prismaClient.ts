import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../generated/prisma/client.js'
import { env } from '../../config/env.js'

/**
 * Singleton Prisma client for persistent (PostgreSQL) memory storage.
 *
 * This is connection plumbing ONLY — it exports the configured client
 * and nothing else. No repository logic, no query methods, and no
 * MemoryRepository implementation live here yet; that is
 * PostgresMemoryRepository, added in a later checkpoint.
 *
 * Prisma 7 requires an explicit driver adapter at the application-runtime
 * level (schema-level `datasource.url` is no longer sufficient — see
 * prisma.config.ts, which governs only the CLI/Migrate's own connection).
 * @prisma/adapter-pg wraps a plain `pg` connection, giving a normal
 * direct PostgreSQL connection — no Prisma Accelerate involved.
 *
 * DATABASE_URL is read through the application's single
 * environment-configuration source (src/config/env.ts) rather than
 * accessing process.env directly, consistent with the project's
 * existing convention.
 *
 * PrismaClient is imported from the generated output path
 * (src/generated/prisma), not from the `@prisma/client` package
 * directly — Prisma 7's `prisma-client` generator writes client code
 * into a project-relative folder rather than into node_modules. That
 * folder must be regenerated via `pnpm db:generate` and should be
 * excluded from version control (see .gitignore).
 */
if (!env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Persistent (PostgreSQL) memory storage ' +
      'requires DATABASE_URL to be configured in the environment — see ' +
      '.env.example.',
  )
}

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL })

export const prisma = new PrismaClient({ adapter })
