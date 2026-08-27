import { prisma } from './prismaClient.js'

/**
 * Minimal PostgreSQL connection smoke test.
 *
 * This is NOT part of the deterministic src/tests/ suite — unlike every
 * existing test in this project, it depends on a real, reachable
 * PostgreSQL instance (via DATABASE_URL) and is not meant to run as
 * part of the normal, fully in-memory test run. Run it explicitly via:
 *
 *   pnpm db:verify-connection
 *
 * It only confirms that a connection can be established and a trivial
 * query executed — it does not touch the `memories` table (which does
 * not exist yet) or any repository logic.
 */
async function main(): Promise<void> {
  console.log('🔌 Verifying PostgreSQL connection...')

  try {
    const result = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`

    if (result[0]?.ok === 1) {
      console.log(' PostgreSQL connection succeeded.')
    } else {
      console.log(' PostgreSQL query returned an unexpected result:', result)
      process.exitCode = 1
    }
  } catch (error) {
    console.error(' PostgreSQL connection failed:')
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
