import { prisma } from './prismaClient.js'
import type { Memory as MemoryRow } from '../../generated/prisma/client.js'
import type { AthenaUserId, Memory } from '../Memory.js'
import type { MemoryRepository } from '../MemoryRepository.js'

/**
 * PostgreSQL implementation of MemoryRepository (Prisma, `memories` table).
 *
 * Behavioral contract — identical to InMemoryMemoryRepository:
 *  - create(): a duplicate id replaces the existing record (Map.set semantics)
 *  - getById(): returns undefined for a missing id
 *  - update(): throws the repository-style error for a missing id
 *  - delete(): returns false for a missing id
 *
 * Storage concerns this adapter owns (and nothing else):
 *  - BigInt (column) ↔ number (domain) timestamp conversion
 *  - Flattening the Memory union into the single-table row shape and
 *    expanding rows back into the union, failing loudly on rows that
 *    cannot form a valid Memory.
 *
 * Uses the shared `prisma` singleton from prismaClient.ts (which owns the
 * DATABASE_URL fail-fast guard). Pure persistence adapter: no runtime or
 * application wiring refers to this class yet.
 */
export class PostgresMemoryRepository implements MemoryRepository {
  /** Map.set() semantics: an existing id is fully replaced. */
  async create(memory: Memory): Promise<Memory> {
    const data = toPrismaData(memory)
    const row = await prisma.memory.upsert({
      where: { id: memory.id },
      create: data,
      update: data, // identical payload: replacement, not merge
    })
    return toMemory(row)
  }

  async getById(id: string): Promise<Memory | undefined> {
    const row = await prisma.memory.findUnique({ where: { id } })
    return row === null ? undefined : toMemory(row)
  }

  async getByOwner(ownerId: AthenaUserId): Promise<Memory[]> {
    // No ordering: ordering is not part of the MemoryRepository contract.
    const rows = await prisma.memory.findMany({ where: { ownerId } })
    return rows.map((row) => toMemory(row))
  }

  /**
   * Full-row replace, matching the in-memory implementation. Timestamps are
   * written exactly as the caller provides — this repository never bumps
   * updatedAt; freshness is MemoryManager's responsibility.
   */
  async update(memory: Memory): Promise<Memory> {
    try {
      const row = await prisma.memory.update({
        where: { id: memory.id },
        data: toPrismaData(memory),
      })
      return toMemory(row)
    } catch (error) {
      if (isPrismaRecordNotFound(error)) {
        // Exact contract message; `cause` keeps the original P2025 for debugging.
        throw new Error(
          `Cannot update memory: no memory found with id "${memory.id}"`,
          { cause: error },
        )
      }
      throw error // connection failures, constraint violations, etc. propagate untouched
    }
  }

  async delete(id: string): Promise<boolean> {
    const result = await prisma.memory.deleteMany({ where: { id } })
    return result.count > 0 // id is the primary key: count is 0 or 1
  }
}

// ---------------------------------------------------------------------------
// Mapping — the only place where the storage shape and the domain shape meet.
// ---------------------------------------------------------------------------

/** Complete write payload for a row in the `memories` table. */
interface MemoryWriteData {
  id: string
  ownerId: string
  type: Memory['type']
  content: string
  conversationId: string | null
  sourceMessageCount: number | null
  createdAt: bigint
  updatedAt: bigint
}

/**
 * Flattens a domain Memory into a complete row payload.
 *
 * USER_PROFILE and EXPLICIT memories force conversationId/sourceMessageCount
 * to null — active normalization, so a stale summary value can never survive
 * a rewrite. CONVERSATION_SUMMARY memories carry both fields.
 */
function toPrismaData(memory: Memory): MemoryWriteData {
  const isSummary = memory.type === 'CONVERSATION_SUMMARY'
  return {
    id: memory.id,
    ownerId: memory.ownerId,
    type: memory.type,
    content: memory.content,
    conversationId: isSummary ? memory.conversationId : null,
    sourceMessageCount: isSummary ? memory.sourceMessageCount : null,
    // Domain timestamps are epoch-millisecond numbers. BigInt() throws a
    // RangeError on non-integers, so caller bugs surface loudly.
    createdAt: BigInt(memory.createdAt),
    updatedAt: BigInt(memory.updatedAt),
  }
}

/**
 * Expands a `memories` row back into the domain Memory union.
 *
 * Throws — rather than silently constructing an invalid Memory — when a row
 * cannot be represented: a CONVERSATION_SUMMARY with a null required field,
 * or a type the domain union does not define.
 */
function toMemory(row: MemoryRow): Memory {
  const base = {
    id: row.id,
    // No-op if AthenaUserId is a plain string alias; required if branded.
    ownerId: row.ownerId,
    content: row.content,
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
  }

  switch (row.type) {
    case 'USER_PROFILE':
      return { ...base, type: row.type }
    case 'EXPLICIT':
      return { ...base, type: row.type }
    case 'CONVERSATION_SUMMARY': {
      if (row.conversationId === null || row.sourceMessageCount === null) {
        throw new Error(
          `Invalid CONVERSATION_SUMMARY row (id "${row.id}"): conversationId and ` +
            `sourceMessageCount must both be present — the memories table ` +
            `contains data inconsistent with the Memory model.`,
        )
      }
      return {
        ...base,
        type: row.type,
        conversationId: row.conversationId,
        sourceMessageCount: row.sourceMessageCount,
      }
    }
    default:
      // Unreachable while schema and domain stay in sync; guards drift.
      throw new Error(
        `Unknown memory type "${String(row.type)}" in row (id "${row.id}") — ` +
          `the memories table contains a type the Memory model does not define.`,
      )
  }
}

/**
 * True only for Prisma's documented "record not found" error (code P2025).
 *
 * Duck-typed on the stable `code` property instead of instanceof on a
 * generated error class, so this file imports nothing extra from the
 * generated client. Every other error — connection failures, constraint
 * violations, anything — returns false and propagates untouched.
 */
function isPrismaRecordNotFound(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error as Error & { code?: unknown }).code === 'P2025'
  )
}
