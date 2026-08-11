import type { AthenaUserId, Memory } from './Memory.js'

/**
 * Storage boundary between the future MemoryManager and whatever
 * persistence technology Athena eventually uses.
 *
 * MemoryRepository defines *what* storage operations exist, not *how*
 * they're performed. It exposes no SQL, ORM, database client, filesystem,
 * Discord, or AI-provider types — a concrete implementation (in-memory,
 * a real database, etc.) can be swapped in behind this interface without
 * the MemoryManager or Athena knowing the difference.
 *
 * No implementation is provided here — this is the abstraction only.
 */
export interface MemoryRepository {
  /**
   * Persists a new memory record.
   *
   * The caller is responsible for constructing a complete `Memory`
   * (id, timestamps, etc.) — the repository only stores it.
   *
   * @returns The persisted memory record.
   */
  create(memory: Memory): Promise<Memory>

  /**
   * Retrieves a single memory by its ID.
   *
   * @returns The memory, or undefined if no memory with that ID exists.
   */
  getById(id: string): Promise<Memory | undefined>

  /**
   * Retrieves all memories belonging to a given owner.
   *
   * @returns The owner's memories, or an empty array if they have none.
   */
  getByOwner(ownerId: AthenaUserId): Promise<Memory[]>

  /**
   * Persists changes to an existing memory record.
   *
   * The caller is responsible for supplying the full, already-updated
   * `Memory` (including a refreshed updatedAt) — the repository only
   * stores it.
   *
   * @returns The persisted memory record.
   */
  update(memory: Memory): Promise<Memory>

  /**
   * Permanently removes a memory by its ID.
   *
   * @returns true if a memory was deleted, false if no memory with that
   * ID existed.
   */
  delete(id: string): Promise<boolean>
}
