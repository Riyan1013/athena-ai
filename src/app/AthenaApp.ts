import { GeminiProvider } from '../ai/providers/GeminiProvider.js'
import { env } from '../config/env.js'
import { ConversationManager } from '../conversation/ConversationManager.js'
import { Athena } from '../core/Athena.js'
import { DiscordClient } from '../discord/DiscordClient.js'
import { InMemoryMemoryRepository } from '../memory/InMemoryMemoryRepository.js'
import { MemoryManager } from '../memory/MemoryManager.js'
import type { MemoryRepository } from '../memory/MemoryRepository.js'

/** In-memory mode has no persistence resources to release. */
const disposeNothing = (): Promise<void> => Promise.resolve()

// Application bootstrapper and composition root.
// Selects the memory storage backend from configuration, wires Athena's
// object graph, and starts/stops Athena's interfaces.
//
// Storage selection (single source of truth: DATABASE_URL presence):
//   DATABASE_URL unset → InMemoryMemoryRepository (volatile; warned loudly)
//   DATABASE_URL set   → PostgresMemoryRepository (verified before start)
//
// There is NO fallback from PostgreSQL to in-memory: if DATABASE_URL is set
// but the database is unusable, create() rejects and the process exits
// before Discord connects — the bot must never appear online while
// silently losing memories.
export class AthenaApp {
  private readonly athena: Athena
  private readonly discord: DiscordClient

  private constructor(
    memoryRepository: MemoryRepository,
    private readonly disposePersistence: () => Promise<void>,
  ) {
    const provider = new GeminiProvider()
    const conversationManager = new ConversationManager()

    const memoryManager = new MemoryManager(memoryRepository)

    this.athena = new Athena(provider, conversationManager, memoryManager)

    this.discord = new DiscordClient(this.athena)
  }

  /**
   * Async factory — the composition root. Storage selection and verification
   * happen here because the PostgreSQL backend requires a dynamic import
   * (prismaClient.ts throws during module evaluation when DATABASE_URL is
   * unset; a static import would make PostgreSQL mandatory process-wide)
   * and an async startup probe.
   *
   * The constructor stays private so an AthenaApp is always fully wired:
   * there is no constructed-but-not-yet-usable state, and a failed create()
   * leaves no half-built object behind.
   */
  static async create(): Promise<AthenaApp> {
    if (env.DATABASE_URL === undefined) {
      console.warn(
        'MEMORY STORAGE: in-memory (volatile) — memories will NOT survive ' +
          'restarts. Set DATABASE_URL to enable persistent PostgreSQL memory.',
      )
      return new AthenaApp(new InMemoryMemoryRepository(), disposeNothing)
    }

    console.log(
      'MEMORY STORAGE: PostgreSQL (DATABASE_URL is set) — connecting…',
    )

    // Dynamic imports: never evaluated in in-memory mode. Evaluating
    // prismaClient.ts initializes the Prisma client singleton; its
    // DATABASE_URL guard can only pass at this point.
    const { PostgresMemoryRepository } =
      await import('../memory/postgres/PostgresMemoryRepository.js')
    const { prisma } = await import('../memory/postgres/prismaClient.js')

    // Startup probe, before Discord connects: a real query against the
    // memories table proves BOTH connectivity and that migrations are
    // applied. On failure we fail loudly — never fall back to in-memory.
    try {
      await prisma.$queryRaw`SELECT 1 FROM memories LIMIT 1`
    } catch (error) {
      throw new Error(
        'DATABASE_URL is set but PostgreSQL is not usable (unreachable, or ' +
          'migrations not applied) — refusing to start with volatile memory. ' +
          'Fix the connection, or unset DATABASE_URL to deliberately run ' +
          'in-memory.',
        { cause: error },
      )
    }

    console.log(
      'MEMORY STORAGE: PostgreSQL connected — memories are persistent.',
    )

    return new AthenaApp(new PostgresMemoryRepository(), () =>
      prisma.$disconnect(),
    )
  }

  async start(): Promise<void> {
    await this.discord.start()
  }

  async stop(): Promise<void> {
    this.discord.stop()
    // Interfaces down first, then release the database pool.
    await this.disposePersistence()
  }
}
