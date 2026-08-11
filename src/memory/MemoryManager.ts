import type { AthenaUserId, Memory } from './Memory.js'
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
}
