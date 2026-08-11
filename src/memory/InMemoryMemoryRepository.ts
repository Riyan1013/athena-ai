import type { AthenaUserId, Memory } from './Memory.js'
import type { MemoryRepository } from './MemoryRepository.js'

/**
 * In-memory implementation of MemoryRepository (Phase 3).
 *
 * Stores Memory records in a Map keyed by id. This is the first concrete
 * storage implementation behind the MemoryRepository abstraction — it
 * knows nothing about Discord, Gemini, Athena prompts, or how memories
 * are decided upon; it only stores what it's given.
 *
 * Not persistent: all data is lost when the process exits.
 */
export class InMemoryMemoryRepository implements MemoryRepository {
  private readonly memories = new Map<string, Memory>()

  async create(memory: Memory): Promise<Memory> {
    this.memories.set(memory.id, memory)
    return memory
  }

  async getById(id: string): Promise<Memory | undefined> {
    return this.memories.get(id)
  }

  async getByOwner(ownerId: AthenaUserId): Promise<Memory[]> {
    const owned: Memory[] = []
    for (const memory of this.memories.values()) {
      if (memory.ownerId === ownerId) {
        owned.push(memory)
      }
    }
    return owned
  }

  /**
   * Replaces an existing memory record.
   *
   * Throws if no memory with the given id already exists — update() is
   * distinct from create() and must not silently create a new record.
   */
  async update(memory: Memory): Promise<Memory> {
    if (!this.memories.has(memory.id)) {
      throw new Error(
        `Cannot update memory: no memory found with id "${memory.id}"`,
      )
    }
    this.memories.set(memory.id, memory)
    return memory
  }

  async delete(id: string): Promise<boolean> {
    return this.memories.delete(id)
  }
}
