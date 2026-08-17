/**
 * Data definitions for Athena's Memory System (Phase 3).
 *
 * This file defines the shape of a memory record only — no storage,
 * retrieval, or management behavior. See docs/MEMORY.md for the
 * architectural rationale behind these types.
 */

/**
 * Identifies who a memory belongs to, at the Athena platform level.
 *
 * This is intentionally not a Discord user ID or any other
 * interface-specific identifier — memory must remain interface-independent
 * (docs/MEMORY.md §13). Authentication and account management are not
 * implemented yet; for now this is simply an opaque string identity.
 */
export type AthenaUserId = string

/**
 * The supported categories of memory (docs/MEMORY.md §3).
 */
export type MemoryType = 'USER_PROFILE' | 'EXPLICIT' | 'CONVERSATION_SUMMARY'

/**
 * Fields shared by every memory record, regardless of category.
 */
interface BaseMemory {
  /** Unique identifier for this memory record. */
  readonly id: string

  /** The Athena-level user this memory belongs to. */
  readonly ownerId: AthenaUserId

  /** Which memory category this record belongs to. */
  readonly type: MemoryType

  /** The substantive text of the memory. */
  readonly content: string

  /** When this memory was first created. */
  readonly createdAt: number

  /** When this memory was last updated. */
  readonly updatedAt: number
}

/**
 * Stable, low-volatility information about a user
 * (docs/MEMORY.md §3.1) — e.g. name, communication preferences,
 * general interests.
 */
export interface UserProfileMemory extends BaseMemory {
  readonly type: 'USER_PROFILE'
}

/**
 * Information the user intentionally asked Athena to remember
 * (docs/MEMORY.md §3.2), e.g. "Remember that I prefer concise answers."
 */
export interface ExplicitMemory extends BaseMemory {
  readonly type: 'EXPLICIT'
}

/**
 * A condensed summary of a past conversation (docs/MEMORY.md §3.3),
 * as distinct from that conversation's raw message history.
 */
export interface ConversationSummaryMemory extends BaseMemory {
  readonly type: 'CONVERSATION_SUMMARY'

  /** The Conversation this summary condenses. */
  readonly conversationId: string

  /**
   * The number of conversation messages represented by this summary at
   * the time it was generated/updated. Purely descriptive metadata —
   * Memory.ts does not itself decide anything from this value. It lets
   * a future automatic-trigger step compare against a conversation's
   * current message count to decide whether enough new messages have
   * accumulated to warrant regenerating the summary.
   */
  readonly sourceMessageCount: number
}

/**
 * A memory record, discriminated by `type`.
 *
 * Phase 3 supports exactly these three categories. Future categories
 * (docs/MEMORY.md §3.4 — semantic, project, knowledge memories) would be
 * added here as additional union members, not by widening this model.
 */
export type Memory =
  | UserProfileMemory
  | ExplicitMemory
  | ConversationSummaryMemory
