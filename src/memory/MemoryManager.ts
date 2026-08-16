import type {
  AthenaUserId,
  ConversationSummaryMemory,
  ExplicitMemory,
  Memory,
  MemoryType,
  UserProfileMemory,
} from './Memory.js'
import type { MemoryRepository } from './MemoryRepository.js'

/**
 * Input for creating a UserProfileMemory.
 *
 * The manager generates `id`, `createdAt`, and `updatedAt` — callers only
 * supply the fields that are actually theirs to decide.
 */
export interface CreateUserProfileMemoryInput {
  readonly ownerId: AthenaUserId
  readonly type: 'USER_PROFILE'
  readonly content: string
}

/**
 * Input for creating an ExplicitMemory.
 */
export interface CreateExplicitMemoryInput {
  readonly ownerId: AthenaUserId
  readonly type: 'EXPLICIT'
  readonly content: string
}

/**
 * Input for creating a ConversationSummaryMemory.
 *
 * `conversationId` is required here because it is required on the
 * corresponding Memory variant — the input type mirrors that.
 */
export interface CreateConversationSummaryMemoryInput {
  readonly ownerId: AthenaUserId
  readonly type: 'CONVERSATION_SUMMARY'
  readonly content: string
  readonly conversationId: string
}

/**
 * Input for creating any memory, discriminated by `type` exactly like
 * `Memory` itself (docs/MEMORY.md §3).
 */
export type CreateMemoryInput =
  | CreateUserProfileMemoryInput
  | CreateExplicitMemoryInput
  | CreateConversationSummaryMemoryInput

/**
 * Input for updating a memory.
 *
 * Phase 3 supports changing only `content` — the one field that is safe
 * and meaningful to edit across every memory category. `id`, `type`,
 * `ownerId`, `createdAt`, and any category-specific fields (such as
 * `conversationId`) are preserved from the existing record.
 */
export interface UpdateMemoryInput {
  readonly id: string
  readonly content: string
}

/**
 * Deterministic retrieval options for getMemories().
 *
 * This is a plain filter/sort/limit over an owner's stored memories —
 * no relevance scoring, ranking, or semantic matching. That is a later,
 * separate capability.
 */
export interface RetrieveMemoriesOptions {
  /** Restrict results to a single memory category. Omit for all types. */
  readonly type?: MemoryType

  /**
   * Sort direction by `createdAt`. Defaults to 'asc' (oldest first).
   * 'desc' returns newest first.
   */
  readonly order?: 'asc' | 'desc'

  /**
   * Maximum number of memories to return, applied after filtering and
   * sorting.
   */
  readonly limit?: number
}

/**
 * Business-facing API for memory lifecycle operations (docs/MEMORY.md).
 *
 * MemoryManager sits above MemoryRepository: the repository answers
 * "how do I store/retrieve a memory?", MemoryManager answers "what
 * memory operation should Athena perform?". It owns memory identity
 * (id generation) and timestamps, and preserves the discriminated
 * Memory union when assembling records — but it does not decide
 * whether something should become a memory, analyze messages, call
 * any AI provider, or perform search/ranking/summarization. Those are
 * later responsibilities.
 *
 * Depends on the MemoryRepository abstraction only, so a future
 * DatabaseMemoryRepository can be substituted without any change here.
 */
export class MemoryManager {
  constructor(private readonly repository: MemoryRepository) {}

  /**
   * Creates a new memory from the given input, generating its id and
   * timestamps and preserving the correct discriminated Memory type.
   */
  async create(input: CreateMemoryInput): Promise<Memory> {
    const now = Date.now()
    const id = crypto.randomUUID()

    let memory: Memory

    switch (input.type) {
      case 'USER_PROFILE':
        memory = {
          id,
          ownerId: input.ownerId,
          type: 'USER_PROFILE',
          content: input.content,
          createdAt: now,
          updatedAt: now,
        }
        break
      case 'EXPLICIT':
        memory = {
          id,
          ownerId: input.ownerId,
          type: 'EXPLICIT',
          content: input.content,
          createdAt: now,
          updatedAt: now,
        }
        break
      case 'CONVERSATION_SUMMARY':
        memory = {
          id,
          ownerId: input.ownerId,
          type: 'CONVERSATION_SUMMARY',
          content: input.content,
          conversationId: input.conversationId,
          createdAt: now,
          updatedAt: now,
        }
        break
    }

    return this.repository.create(memory)
  }

  /**
   * Retrieves a single memory by its id.
   *
   * @returns The memory, or undefined if no memory with that id exists.
   */
  async getById(id: string): Promise<Memory | undefined> {
    return this.repository.getById(id)
  }

  /**
   * Retrieves all memories belonging to a given owner.
   *
   * @returns The owner's memories, or an empty array if they have none.
   */
  async getByOwner(ownerId: AthenaUserId): Promise<Memory[]> {
    return this.repository.getByOwner(ownerId)
  }

  /**
   * Updates an existing memory's content.
   *
   * Loads the current record, replaces only `content`, and refreshes
   * `updatedAt` — `id`, `type`, `ownerId`, `createdAt`, and any
   * category-specific fields are preserved unchanged. Throws if no
   * memory with the given id exists; update never silently creates one.
   */
  async update(input: UpdateMemoryInput): Promise<Memory> {
    const existing = await this.repository.getById(input.id)

    if (!existing) {
      throw new Error(
        `Cannot update memory: no memory found with id "${input.id}"`,
      )
    }

    const updated: Memory = {
      ...existing,
      content: input.content,
      updatedAt: Date.now(),
    }

    return this.repository.update(updated)
  }

  /**
   * Deletes a memory by id.
   *
   * @returns true if a memory was deleted, false if no memory with that
   * id existed.
   */
  async delete(id: string): Promise<boolean> {
    return this.repository.delete(id)
  }

  // ---------------------------------------------------------------------
  // Retrieval
  //
  // Deterministic filter/sort/limit over an owner's stored memories,
  // built on top of the existing repository.getByOwner(). No relevance
  // scoring, ranking, or semantic matching — that is a later, separate
  // capability. getUserProfile() and getExplicitMemories() remain the
  // more ergonomic entry points for those specific categories; this is
  // the general-purpose method for mixed types, ordering, and limiting.
  // ---------------------------------------------------------------------

  /**
   * Retrieves an owner's memories, optionally filtered by type, sorted
   * by `createdAt`, and capped by a limit.
   *
   * @returns A new array — never the repository's or manager's internal
   * state — so callers can freely mutate the result without affecting
   * subsequent retrievals.
   */
  async getMemories(
    ownerId: AthenaUserId,
    options: RetrieveMemoriesOptions = {},
  ): Promise<Memory[]> {
    const memories = await this.repository.getByOwner(ownerId)

    const filtered = options.type
      ? memories.filter((memory) => memory.type === options.type)
      : [...memories]

    const direction = options.order === 'desc' ? -1 : 1
    filtered.sort((a, b) => (a.createdAt - b.createdAt) * direction)

    if (typeof options.limit === 'number') {
      return filtered.slice(0, options.limit)
    }

    return filtered
  }

  // ---------------------------------------------------------------------
  // User Profile
  //
  // A user has at most one USER_PROFILE memory (docs/MEMORY.md §3.1).
  // These methods enforce that invariant on top of the generic
  // create/getByOwner/update/delete operations above — they add no new
  // storage capability, only the "one profile per owner" business rule.
  // ---------------------------------------------------------------------

  /**
   * Retrieves the given owner's User Profile memory, if one exists.
   */
  async getUserProfile(
    ownerId: AthenaUserId,
  ): Promise<UserProfileMemory | undefined> {
    const memories = await this.repository.getByOwner(ownerId)

    return memories.find(
      (memory): memory is UserProfileMemory => memory.type === 'USER_PROFILE',
    )
  }

  /**
   * Creates or replaces the given owner's User Profile content.
   *
   * If no profile exists yet, one is created. If one exists, its content
   * is replaced and `updatedAt` is refreshed — `id` and `createdAt` are
   * preserved. This replaces the entire content rather than merging it;
   * callers are responsible for supplying the full profile text they
   * want stored.
   */
  async upsertUserProfile(
    ownerId: AthenaUserId,
    content: string,
  ): Promise<UserProfileMemory> {
    const existing = await this.getUserProfile(ownerId)

    if (existing) {
      const updated = await this.repository.update({
        ...existing,
        content,
        updatedAt: Date.now(),
      })

      if (updated.type !== 'USER_PROFILE') {
        throw new Error(
          'Expected updating a USER_PROFILE memory to preserve its type.',
        )
      }

      return updated
    }

    const created = await this.create({
      ownerId,
      type: 'USER_PROFILE',
      content,
    })

    if (created.type !== 'USER_PROFILE') {
      throw new Error('Expected create() to produce a USER_PROFILE memory.')
    }

    return created
  }

  /**
   * Deletes the given owner's User Profile, if one exists.
   *
   * @returns true if a profile was deleted, false if the owner had none.
   */
  async deleteUserProfile(ownerId: AthenaUserId): Promise<boolean> {
    const existing = await this.getUserProfile(ownerId)

    if (!existing) {
      return false
    }

    return this.repository.delete(existing.id)
  }

  // ---------------------------------------------------------------------
  // Explicit Memory
  //
  // Unlike USER_PROFILE, EXPLICIT memories are not a singleton — a user
  // may have any number of independent explicit memories. The generic
  // create(), update(), and delete() methods above are already sufficient
  // for creating, editing, and removing individual explicit memories; the
  // only gap is retrieval scoped to just this category, which is what
  // this method adds.
  // ---------------------------------------------------------------------

  /**
   * Retrieves all EXPLICIT memories belonging to a given owner.
   *
   * @returns The owner's explicit memories, or an empty array if they
   * have none. Order is not guaranteed.
   */
  async getExplicitMemories(ownerId: AthenaUserId): Promise<ExplicitMemory[]> {
    const memories = await this.repository.getByOwner(ownerId)

    return memories.filter(
      (memory): memory is ExplicitMemory => memory.type === 'EXPLICIT',
    )
  }

  // ---------------------------------------------------------------------
  // Conversation Summary
  //
  // Exactly one CONVERSATION_SUMMARY memory exists per (ownerId,
  // conversationId) pair — a singleton scoped to a conversation rather
  // than to an owner alone, mirroring the USER_PROFILE singleton pattern
  // above. MemoryManager only stores whatever summary content it is
  // given; it never generates, merges, or reinterprets summary text —
  // that responsibility belongs to a later orchestration layer.
  // ---------------------------------------------------------------------

  /**
   * Retrieves the summary for a specific owner's conversation, if one
   * exists.
   */
  async getConversationSummary(
    ownerId: AthenaUserId,
    conversationId: string,
  ): Promise<ConversationSummaryMemory | undefined> {
    const memories = await this.repository.getByOwner(ownerId)

    return memories.find(
      (memory): memory is ConversationSummaryMemory =>
        memory.type === 'CONVERSATION_SUMMARY' &&
        memory.conversationId === conversationId,
    )
  }

  /**
   * Creates or replaces the summary for a specific owner's conversation.
   *
   * If no summary exists yet for this (ownerId, conversationId) pair,
   * one is created. If one exists, its content is replaced wholesale and
   * `updatedAt` is refreshed — `id`, `createdAt`, `ownerId`, and
   * `conversationId` are preserved. This replaces the entire content
   * rather than merging it; callers are responsible for supplying the
   * full summary text they want stored.
   */
  async upsertConversationSummary(
    ownerId: AthenaUserId,
    conversationId: string,
    content: string,
  ): Promise<ConversationSummaryMemory> {
    const existing = await this.getConversationSummary(ownerId, conversationId)

    if (existing) {
      const updated = await this.repository.update({
        ...existing,
        content,
        updatedAt: Date.now(),
      })

      if (updated.type !== 'CONVERSATION_SUMMARY') {
        throw new Error(
          'Expected updating a CONVERSATION_SUMMARY memory to preserve its type.',
        )
      }

      return updated
    }

    const created = await this.create({
      ownerId,
      type: 'CONVERSATION_SUMMARY',
      content,
      conversationId,
    })

    if (created.type !== 'CONVERSATION_SUMMARY') {
      throw new Error(
        'Expected create() to produce a CONVERSATION_SUMMARY memory.',
      )
    }

    return created
  }

  /**
   * Deletes the summary for a specific owner's conversation, if one
   * exists.
   *
   * @returns true if a summary was deleted, false if none existed for
   * that (ownerId, conversationId) pair.
   */
  async deleteConversationSummary(
    ownerId: AthenaUserId,
    conversationId: string,
  ): Promise<boolean> {
    const existing = await this.getConversationSummary(ownerId, conversationId)

    if (!existing) {
      return false
    }

    return this.repository.delete(existing.id)
  }
}
