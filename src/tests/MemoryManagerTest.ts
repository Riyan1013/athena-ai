import assert from 'node:assert/strict'
import type { Memory } from '../memory/Memory.js'
import type { MemoryRepository } from '../memory/MemoryRepository.js'
import { InMemoryMemoryRepository } from '../memory/InMemoryMemoryRepository.js'
import { MemoryManager } from '../memory/MemoryManager.js'

/**
 * Local, dependency-free test suite for MemoryManager.
 *
 * Exercises MemoryManager only through its public API (create/getById/
 * getByOwner/update/delete, plus the User Profile methods,
 * getExplicitMemories(), and getMemories()). The manager is constructed
 * against the MemoryRepository abstraction — not InMemoryMemoryRepository
 * directly — so these tests also confirm that dependency stays
 * interface-level. No network, no Gemini, no Discord.
 */

type TestFn = () => Promise<void> | void

interface TestCase {
  name: string
  fn: TestFn
}

const tests: TestCase[] = []

function test(name: string, fn: TestFn): void {
  tests.push({ name, fn })
}

/** Fresh manager for each test, built against the repository abstraction. */
function makeManager(): MemoryManager {
  const repository: MemoryRepository = new InMemoryMemoryRepository()
  return new MemoryManager(repository)
}

/**
 * Minimal MemoryRepository test double backed by fixed, caller-supplied
 * Memory records with deterministic `createdAt` values.
 *
 * Used only for retrieval-order tests, where we need precise, reproducible
 * `createdAt` ordering without relying on real timers (no setTimeout/sleep)
 * and without changing the production MemoryRepository interface.
 */
class FakeMemoryRepository implements MemoryRepository {
  private readonly memories = new Map<string, Memory>()

  constructor(seed: Memory[] = []) {
    for (const memory of seed) {
      this.memories.set(memory.id, memory)
    }
  }

  async create(memory: Memory): Promise<Memory> {
    this.memories.set(memory.id, memory)
    return memory
  }

  async getById(id: string): Promise<Memory | undefined> {
    return this.memories.get(id)
  }

  async getByOwner(ownerId: string): Promise<Memory[]> {
    const owned: Memory[] = []
    for (const memory of this.memories.values()) {
      if (memory.ownerId === ownerId) {
        owned.push(memory)
      }
    }
    return owned
  }

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

function assertValidTimestamp(value: unknown, label: string): void {
  assert.equal(typeof value, 'number', `${label} should be a number`)
  assert.ok(
    Number.isFinite(value as number),
    `${label} should be a finite number`,
  )
}

// ---------------------------------------------------------------------
// 1. create() — USER_PROFILE
// ---------------------------------------------------------------------

test('create() creates a USER_PROFILE memory with generated id and timestamps', async () => {
  const manager = makeManager()

  const created = await manager.create({
    ownerId: 'owner-1',
    type: 'USER_PROFILE',
    content: 'Prefers concise answers.',
  })

  assert.equal(created.type, 'USER_PROFILE')
  assert.equal(created.ownerId, 'owner-1')
  assert.equal(created.content, 'Prefers concise answers.')
  assert.equal(typeof created.id, 'string')
  assert.ok(created.id.length > 0)
  assertValidTimestamp(created.createdAt, 'createdAt')
  assertValidTimestamp(created.updatedAt, 'updatedAt')

  const fetched = await manager.getById(created.id)
  assert.deepEqual(fetched, created)
})

// ---------------------------------------------------------------------
// 2. create() — EXPLICIT
// ---------------------------------------------------------------------

test('create() creates an EXPLICIT memory with generated id and timestamps', async () => {
  const manager = makeManager()

  const created = await manager.create({
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'Remember that I prefer TypeScript.',
  })

  assert.equal(created.type, 'EXPLICIT')
  assert.equal(created.ownerId, 'owner-1')
  assert.equal(created.content, 'Remember that I prefer TypeScript.')
  assert.equal(typeof created.id, 'string')
  assert.ok(created.id.length > 0)
  assertValidTimestamp(created.createdAt, 'createdAt')
  assertValidTimestamp(created.updatedAt, 'updatedAt')

  const fetched = await manager.getById(created.id)
  assert.deepEqual(fetched, created)
})

// ---------------------------------------------------------------------
// 3. create() — CONVERSATION_SUMMARY
// ---------------------------------------------------------------------

test('create() creates a CONVERSATION_SUMMARY memory preserving conversationId', async () => {
  const manager = makeManager()

  const created = await manager.create({
    ownerId: 'owner-1',
    type: 'CONVERSATION_SUMMARY',
    content: 'Discussed Phase 3 memory architecture.',
    conversationId: 'conv-42',
  })

  assert.equal(created.type, 'CONVERSATION_SUMMARY')
  assert.equal(created.ownerId, 'owner-1')
  assert.equal(created.content, 'Discussed Phase 3 memory architecture.')
  assert.equal(typeof created.id, 'string')
  assert.ok(created.id.length > 0)
  assert.equal(
    'conversationId' in created ? created.conversationId : undefined,
    'conv-42',
  )

  const fetched = await manager.getById(created.id)
  assert.deepEqual(fetched, created)
})

// ---------------------------------------------------------------------
// 4. Unique IDs
// ---------------------------------------------------------------------

test('create() generates unique ids across multiple memories', async () => {
  const manager = makeManager()

  const first = await manager.create({
    ownerId: 'owner-1',
    type: 'USER_PROFILE',
    content: 'First memory.',
  })
  const second = await manager.create({
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'Second memory.',
  })
  const third = await manager.create({
    ownerId: 'owner-1',
    type: 'CONVERSATION_SUMMARY',
    content: 'Third memory.',
    conversationId: 'conv-1',
  })

  const ids = [first.id, second.id, third.id]
  const uniqueIds = new Set(ids)
  assert.equal(uniqueIds.size, ids.length)
})

// ---------------------------------------------------------------------
// 5. getById()
// ---------------------------------------------------------------------

test('getById() returns the correct memory for an existing id', async () => {
  const manager = makeManager()

  const created = await manager.create({
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'Some explicit memory.',
  })

  const fetched = await manager.getById(created.id)
  assert.deepEqual(fetched, created)
})

test('getById() returns undefined for a nonexistent id', async () => {
  const manager = makeManager()
  const fetched = await manager.getById('does-not-exist')
  assert.equal(fetched, undefined)
})

// ---------------------------------------------------------------------
// 6. getByOwner()
// ---------------------------------------------------------------------

test("getByOwner() returns only the requested owner's memories", async () => {
  const manager = makeManager()

  const ownerAMemory1 = await manager.create({
    ownerId: 'owner-a',
    type: 'USER_PROFILE',
    content: 'Owner A profile.',
  })
  const ownerAMemory2 = await manager.create({
    ownerId: 'owner-a',
    type: 'EXPLICIT',
    content: 'Owner A explicit.',
  })
  const ownerBMemory1 = await manager.create({
    ownerId: 'owner-b',
    type: 'USER_PROFILE',
    content: 'Owner B profile.',
  })

  const ownerAResults = await manager.getByOwner('owner-a')
  assert.equal(ownerAResults.length, 2)
  const ownerAIds = ownerAResults.map((m) => m.id).sort()
  assert.deepEqual(ownerAIds, [ownerAMemory1.id, ownerAMemory2.id].sort())

  const ownerBResults = await manager.getByOwner('owner-b')
  assert.equal(ownerBResults.length, 1)
  assert.equal(ownerBResults[0]?.id, ownerBMemory1.id)
})

// ---------------------------------------------------------------------
// 7. update()
// ---------------------------------------------------------------------

test('update() changes content while preserving id, ownerId, type, and createdAt', async () => {
  const manager = makeManager()

  const created = await manager.create({
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'Original content.',
  })

  const { id, ownerId, type, createdAt } = created

  const updated = await manager.update({
    id: created.id,
    content: 'Updated content.',
  })

  assert.equal(updated.content, 'Updated content.')
  assert.equal(updated.id, id)
  assert.equal(updated.ownerId, ownerId)
  assert.equal(updated.type, type)
  assert.equal(updated.createdAt, createdAt)
  assertValidTimestamp(updated.updatedAt, 'updatedAt')
})

// ---------------------------------------------------------------------
// 8. Conversation summary preservation
// ---------------------------------------------------------------------

test('update() preserves conversationId on a CONVERSATION_SUMMARY memory', async () => {
  const manager = makeManager()

  const created = await manager.create({
    ownerId: 'owner-1',
    type: 'CONVERSATION_SUMMARY',
    content: 'Original summary.',
    conversationId: 'conv-99',
  })

  const updated = await manager.update({
    id: created.id,
    content: 'Updated summary.',
  })

  assert.equal(updated.type, 'CONVERSATION_SUMMARY')
  assert.equal(updated.content, 'Updated summary.')
  assert.equal(
    'conversationId' in updated ? updated.conversationId : undefined,
    'conv-99',
  )
})

// ---------------------------------------------------------------------
// 9. update() with nonexistent id
// ---------------------------------------------------------------------

test('update() rejects when the memory id does not exist', async () => {
  const manager = makeManager()

  await assert.rejects(() =>
    manager.update({ id: 'never-created', content: 'Does not matter.' }),
  )
})

// ---------------------------------------------------------------------
// 10. delete()
// ---------------------------------------------------------------------

test('delete() removes an existing memory and returns true', async () => {
  const manager = makeManager()

  const created = await manager.create({
    ownerId: 'owner-1',
    type: 'USER_PROFILE',
    content: 'To be deleted.',
  })

  const result = await manager.delete(created.id)
  assert.equal(result, true)

  const fetched = await manager.getById(created.id)
  assert.equal(fetched, undefined)
})

// ---------------------------------------------------------------------
// 11. delete() with nonexistent id
// ---------------------------------------------------------------------

test('delete() returns false for a nonexistent id without throwing', async () => {
  const manager = makeManager()
  const result = await manager.delete('never-existed')
  assert.equal(result, false)
})

// ---------------------------------------------------------------------
// 12. Repository abstraction
// ---------------------------------------------------------------------

test('MemoryManager is constructed against the MemoryRepository abstraction', async () => {
  const repository: MemoryRepository = new InMemoryMemoryRepository()
  const manager = new MemoryManager(repository)

  const created = await manager.create({
    ownerId: 'owner-1',
    type: 'USER_PROFILE',
    content: 'Works through the abstraction.',
  })

  const fetched = await manager.getById(created.id)
  assert.deepEqual(fetched, created)
})

// ---------------------------------------------------------------------
// 13. getUserProfile() — no profile yet
// ---------------------------------------------------------------------

test('getUserProfile() returns undefined when the owner has no profile', async () => {
  const manager = makeManager()

  const profile = await manager.getUserProfile('owner-1')
  assert.equal(profile, undefined)
})

// ---------------------------------------------------------------------
// 14. upsertUserProfile() — creates when none exists
// ---------------------------------------------------------------------

test('upsertUserProfile() creates a new USER_PROFILE memory when none exists', async () => {
  const manager = makeManager()

  const profile = await manager.upsertUserProfile(
    'owner-1',
    'Prefers concise answers.',
  )

  assert.equal(profile.type, 'USER_PROFILE')
  assert.equal(profile.ownerId, 'owner-1')
  assert.equal(profile.content, 'Prefers concise answers.')
  assert.equal(typeof profile.id, 'string')
  assert.ok(profile.id.length > 0)
  assertValidTimestamp(profile.createdAt, 'createdAt')
  assertValidTimestamp(profile.updatedAt, 'updatedAt')
})

// ---------------------------------------------------------------------
// 15. upsertUserProfile() — updates the same record on a second call
// ---------------------------------------------------------------------

test('upsertUserProfile() updates the existing profile, preserving id and createdAt', async () => {
  const manager = makeManager()

  const first = await manager.upsertUserProfile('owner-1', 'Original content.')
  const second = await manager.upsertUserProfile('owner-1', 'Updated content.')

  assert.equal(second.id, first.id)
  assert.equal(second.createdAt, first.createdAt)
  assert.equal(second.content, 'Updated content.')
  assert.ok(second.updatedAt >= first.updatedAt)
})

// ---------------------------------------------------------------------
// 16. upsertUserProfile() — scoped per owner
// ---------------------------------------------------------------------

test('upsertUserProfile() keeps profiles independent per owner', async () => {
  const manager = makeManager()

  const ownerA = await manager.upsertUserProfile('owner-a', 'Owner A profile.')
  const ownerB = await manager.upsertUserProfile('owner-b', 'Owner B profile.')

  assert.notEqual(ownerA.id, ownerB.id)

  const fetchedA = await manager.getUserProfile('owner-a')
  const fetchedB = await manager.getUserProfile('owner-b')

  assert.equal(fetchedA?.content, 'Owner A profile.')
  assert.equal(fetchedB?.content, 'Owner B profile.')
})

// ---------------------------------------------------------------------
// 17. upsertUserProfile() — enforces the singleton invariant
// ---------------------------------------------------------------------

test('upsertUserProfile() never produces more than one USER_PROFILE memory per owner', async () => {
  const manager = makeManager()

  await manager.upsertUserProfile('owner-1', 'First.')
  await manager.upsertUserProfile('owner-1', 'Second.')
  await manager.upsertUserProfile('owner-1', 'Third.')

  const allMemories = await manager.getByOwner('owner-1')
  const profileMemories = allMemories.filter((m) => m.type === 'USER_PROFILE')

  assert.equal(profileMemories.length, 1)
  assert.equal(profileMemories[0]?.content, 'Third.')
})

// ---------------------------------------------------------------------
// 18. getUserProfile() — ignores other memory types
// ---------------------------------------------------------------------

test("getUserProfile() ignores the owner's other memory types", async () => {
  const manager = makeManager()

  await manager.create({
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'An explicit memory, not a profile.',
  })
  await manager.create({
    ownerId: 'owner-1',
    type: 'CONVERSATION_SUMMARY',
    content: 'A conversation summary, not a profile.',
    conversationId: 'conv-1',
  })

  const noProfileYet = await manager.getUserProfile('owner-1')
  assert.equal(noProfileYet, undefined)

  const profile = await manager.upsertUserProfile(
    'owner-1',
    'The actual profile.',
  )
  const fetched = await manager.getUserProfile('owner-1')

  assert.equal(fetched?.id, profile.id)
  assert.equal(fetched?.content, 'The actual profile.')
})

// ---------------------------------------------------------------------
// 19. deleteUserProfile() — removes an existing profile
// ---------------------------------------------------------------------

test('deleteUserProfile() removes an existing profile and returns true', async () => {
  const manager = makeManager()

  const profile = await manager.upsertUserProfile('owner-1', 'To be deleted.')

  const result = await manager.deleteUserProfile('owner-1')
  assert.equal(result, true)

  const fetched = await manager.getUserProfile('owner-1')
  assert.equal(fetched, undefined)

  const byId = await manager.getById(profile.id)
  assert.equal(byId, undefined)
})

// ---------------------------------------------------------------------
// 20. deleteUserProfile() — no profile exists
// ---------------------------------------------------------------------

test('deleteUserProfile() returns false when the owner has no profile', async () => {
  const manager = makeManager()

  const result = await manager.deleteUserProfile('owner-1')
  assert.equal(result, false)
})

// ---------------------------------------------------------------------
// 21. getExplicitMemories() — no memories yet
// ---------------------------------------------------------------------

test('getExplicitMemories() returns an empty array when the owner has none', async () => {
  const manager = makeManager()

  const results = await manager.getExplicitMemories('owner-1')
  assert.deepEqual(results, [])
})

// ---------------------------------------------------------------------
// 22. getExplicitMemories() — multiple independent memories for one owner
// ---------------------------------------------------------------------

test('getExplicitMemories() returns multiple independent explicit memories for one owner', async () => {
  const manager = makeManager()

  const first = await manager.create({
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'Prefers TypeScript over JavaScript.',
  })
  const second = await manager.create({
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'Always wants concise answers.',
  })

  const results = await manager.getExplicitMemories('owner-1')
  assert.equal(results.length, 2)

  const resultIds = results.map((m) => m.id).sort()
  assert.deepEqual(resultIds, [first.id, second.id].sort())
  assert.notEqual(first.id, second.id)
})

// ---------------------------------------------------------------------
// 23. getExplicitMemories() — excludes other memory types
// ---------------------------------------------------------------------

test("getExplicitMemories() excludes the owner's other memory types", async () => {
  const manager = makeManager()

  await manager.create({
    ownerId: 'owner-1',
    type: 'USER_PROFILE',
    content: 'A profile, not an explicit memory.',
  })
  const explicitOne = await manager.create({
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'First explicit memory.',
  })
  const explicitTwo = await manager.create({
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'Second explicit memory.',
  })
  await manager.create({
    ownerId: 'owner-1',
    type: 'CONVERSATION_SUMMARY',
    content: 'A summary, not an explicit memory.',
    conversationId: 'conv-1',
  })

  const results = await manager.getExplicitMemories('owner-1')
  assert.equal(results.length, 2)

  const resultIds = results.map((m) => m.id).sort()
  assert.deepEqual(resultIds, [explicitOne.id, explicitTwo.id].sort())
  assert.ok(results.every((m) => m.type === 'EXPLICIT'))
})

// ---------------------------------------------------------------------
// 24. getExplicitMemories() — excludes other owners' explicit memories
// ---------------------------------------------------------------------

test("getExplicitMemories() excludes other owners' explicit memories", async () => {
  const manager = makeManager()

  const ownerAMemory = await manager.create({
    ownerId: 'owner-a',
    type: 'EXPLICIT',
    content: 'Owner A explicit memory.',
  })
  const ownerBMemory = await manager.create({
    ownerId: 'owner-b',
    type: 'EXPLICIT',
    content: 'Owner B explicit memory.',
  })

  const ownerAResults = await manager.getExplicitMemories('owner-a')
  assert.equal(ownerAResults.length, 1)
  assert.equal(ownerAResults[0]?.id, ownerAMemory.id)

  const ownerBResults = await manager.getExplicitMemories('owner-b')
  assert.equal(ownerBResults.length, 1)
  assert.equal(ownerBResults[0]?.id, ownerBMemory.id)
})

// ---------------------------------------------------------------------
// 25. Explicit memories can be updated independently
// ---------------------------------------------------------------------

test('explicit memories can be updated independently of one another', async () => {
  const manager = makeManager()

  const first = await manager.create({
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'Original first memory.',
  })
  const second = await manager.create({
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'Original second memory.',
  })

  await manager.update({
    id: first.id,
    content: 'Updated first memory.',
  })

  const results = await manager.getExplicitMemories('owner-1')
  const updatedFirst = results.find((m) => m.id === first.id)
  const untouchedSecond = results.find((m) => m.id === second.id)

  assert.equal(updatedFirst?.content, 'Updated first memory.')
  assert.equal(untouchedSecond?.content, 'Original second memory.')
})

// ---------------------------------------------------------------------
// 26. Explicit memories can be deleted independently
// ---------------------------------------------------------------------

test('explicit memories can be deleted independently of one another', async () => {
  const manager = makeManager()

  const first = await manager.create({
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'To be deleted.',
  })
  const second = await manager.create({
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'To be kept.',
  })

  const deleteResult = await manager.delete(first.id)
  assert.equal(deleteResult, true)

  const results = await manager.getExplicitMemories('owner-1')
  assert.equal(results.length, 1)
  assert.equal(results[0]?.id, second.id)
  assert.equal(results[0]?.content, 'To be kept.')
})

// ---------------------------------------------------------------------
// 27. create(type: 'EXPLICIT') is consistent with getById() and
// getExplicitMemories()
// ---------------------------------------------------------------------

test('create() for EXPLICIT is consistent with getById() and getExplicitMemories()', async () => {
  const manager = makeManager()

  const created = await manager.create({
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'Remember that I prefer TypeScript.',
  })

  const byId = await manager.getById(created.id)
  assert.deepEqual(byId, created)

  const explicitMemories = await manager.getExplicitMemories('owner-1')
  assert.equal(explicitMemories.length, 1)
  assert.deepEqual(explicitMemories[0], created)
})

// ---------------------------------------------------------------------
// 28. getMemories() — no options returns all of one owner's memories
// ---------------------------------------------------------------------

test("getMemories() with no options returns all of one owner's memories", async () => {
  const profile: Memory = {
    id: 'mem-profile',
    ownerId: 'owner-1',
    type: 'USER_PROFILE',
    content: 'Profile content.',
    createdAt: 1000,
    updatedAt: 1000,
  }
  const explicit: Memory = {
    id: 'mem-explicit',
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'Explicit content.',
    createdAt: 2000,
    updatedAt: 2000,
  }
  const repository = new FakeMemoryRepository([profile, explicit])
  const manager = new MemoryManager(repository)

  const results = await manager.getMemories('owner-1')
  assert.equal(results.length, 2)

  const resultIds = results.map((m) => m.id).sort()
  assert.deepEqual(resultIds, ['mem-explicit', 'mem-profile'])
})

// ---------------------------------------------------------------------
// 29. getMemories() — no memories returns []
// ---------------------------------------------------------------------

test('getMemories() returns an empty array when the owner has no memories', async () => {
  const manager = makeManager()

  const results = await manager.getMemories('owner-1')
  assert.deepEqual(results, [])
})

// ---------------------------------------------------------------------
// 30. getMemories() — type: 'EXPLICIT' filters correctly
// ---------------------------------------------------------------------

test('getMemories({ type: "EXPLICIT" }) returns only explicit memories', async () => {
  const manager = makeManager()

  await manager.create({
    ownerId: 'owner-1',
    type: 'USER_PROFILE',
    content: 'Profile content.',
  })
  const explicitOne = await manager.create({
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'First explicit memory.',
  })
  const explicitTwo = await manager.create({
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'Second explicit memory.',
  })

  const results = await manager.getMemories('owner-1', { type: 'EXPLICIT' })
  assert.equal(results.length, 2)

  const resultIds = results.map((m) => m.id).sort()
  assert.deepEqual(resultIds, [explicitOne.id, explicitTwo.id].sort())
  assert.ok(results.every((m) => m.type === 'EXPLICIT'))
})

// ---------------------------------------------------------------------
// 31. getMemories() — type: 'USER_PROFILE' filters correctly
// ---------------------------------------------------------------------

test('getMemories({ type: "USER_PROFILE" }) returns only the profile memory', async () => {
  const manager = makeManager()

  const profile = await manager.create({
    ownerId: 'owner-1',
    type: 'USER_PROFILE',
    content: 'Profile content.',
  })
  await manager.create({
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'Explicit content.',
  })

  const results = await manager.getMemories('owner-1', {
    type: 'USER_PROFILE',
  })
  assert.equal(results.length, 1)
  assert.equal(results[0]?.id, profile.id)
  assert.equal(results[0]?.type, 'USER_PROFILE')
})

// ---------------------------------------------------------------------
// 32. getMemories() — asc/desc ordering by createdAt
// ---------------------------------------------------------------------

test('getMemories() orders by createdAt ascending by default and descending when requested', async () => {
  const oldest: Memory = {
    id: 'mem-oldest',
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'Oldest.',
    createdAt: 1000,
    updatedAt: 1000,
  }
  const middle: Memory = {
    id: 'mem-middle',
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'Middle.',
    createdAt: 2000,
    updatedAt: 2000,
  }
  const newest: Memory = {
    id: 'mem-newest',
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'Newest.',
    createdAt: 3000,
    updatedAt: 3000,
  }
  // Seed out of createdAt order to ensure sorting isn't accidentally
  // relying on insertion order.
  const repository = new FakeMemoryRepository([newest, oldest, middle])
  const manager = new MemoryManager(repository)

  const ascending = await manager.getMemories('owner-1')
  assert.deepEqual(
    ascending.map((m) => m.id),
    ['mem-oldest', 'mem-middle', 'mem-newest'],
  )

  const ascendingExplicit = await manager.getMemories('owner-1', {
    order: 'asc',
  })
  assert.deepEqual(
    ascendingExplicit.map((m) => m.id),
    ['mem-oldest', 'mem-middle', 'mem-newest'],
  )

  const descending = await manager.getMemories('owner-1', { order: 'desc' })
  assert.deepEqual(
    descending.map((m) => m.id),
    ['mem-newest', 'mem-middle', 'mem-oldest'],
  )
})

// ---------------------------------------------------------------------
// 33. getMemories() — limit applies after sorting
// ---------------------------------------------------------------------

test('getMemories() applies limit after sorting', async () => {
  const first: Memory = {
    id: 'mem-first',
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'First.',
    createdAt: 1000,
    updatedAt: 1000,
  }
  const second: Memory = {
    id: 'mem-second',
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'Second.',
    createdAt: 2000,
    updatedAt: 2000,
  }
  const third: Memory = {
    id: 'mem-third',
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'Third.',
    createdAt: 3000,
    updatedAt: 3000,
  }
  const repository = new FakeMemoryRepository([third, first, second])
  const manager = new MemoryManager(repository)

  const ascendingLimited = await manager.getMemories('owner-1', { limit: 2 })
  assert.deepEqual(
    ascendingLimited.map((m) => m.id),
    ['mem-first', 'mem-second'],
  )

  const descendingLimited = await manager.getMemories('owner-1', {
    order: 'desc',
    limit: 2,
  })
  assert.deepEqual(
    descendingLimited.map((m) => m.id),
    ['mem-third', 'mem-second'],
  )
})

// ---------------------------------------------------------------------
// 34. getMemories() — type + order + limit combined
// ---------------------------------------------------------------------

test('getMemories() applies type filter, order, and limit together', async () => {
  const profile: Memory = {
    id: 'mem-profile',
    ownerId: 'owner-1',
    type: 'USER_PROFILE',
    content: 'Profile.',
    createdAt: 500,
    updatedAt: 500,
  }
  const explicitOldest: Memory = {
    id: 'mem-explicit-oldest',
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'Oldest explicit.',
    createdAt: 1000,
    updatedAt: 1000,
  }
  const explicitMiddle: Memory = {
    id: 'mem-explicit-middle',
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'Middle explicit.',
    createdAt: 2000,
    updatedAt: 2000,
  }
  const explicitNewest: Memory = {
    id: 'mem-explicit-newest',
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'Newest explicit.',
    createdAt: 3000,
    updatedAt: 3000,
  }
  const repository = new FakeMemoryRepository([
    explicitMiddle,
    profile,
    explicitNewest,
    explicitOldest,
  ])
  const manager = new MemoryManager(repository)

  const results = await manager.getMemories('owner-1', {
    type: 'EXPLICIT',
    order: 'desc',
    limit: 2,
  })

  assert.deepEqual(
    results.map((m) => m.id),
    ['mem-explicit-newest', 'mem-explicit-middle'],
  )
  assert.ok(results.every((m) => m.type === 'EXPLICIT'))
})

// ---------------------------------------------------------------------
// 35. getMemories() — owner isolation
// ---------------------------------------------------------------------

test("getMemories() excludes other owners' memories", async () => {
  const manager = makeManager()

  const ownerAMemory = await manager.create({
    ownerId: 'owner-a',
    type: 'EXPLICIT',
    content: 'Owner A memory.',
  })
  const ownerBMemory = await manager.create({
    ownerId: 'owner-b',
    type: 'EXPLICIT',
    content: 'Owner B memory.',
  })

  const ownerAResults = await manager.getMemories('owner-a')
  assert.equal(ownerAResults.length, 1)
  assert.equal(ownerAResults[0]?.id, ownerAMemory.id)

  const ownerBResults = await manager.getMemories('owner-b')
  assert.equal(ownerBResults.length, 1)
  assert.equal(ownerBResults[0]?.id, ownerBMemory.id)
})

// ---------------------------------------------------------------------
// 36. getMemories() — returned array mutation does not affect
// subsequent retrieval
// ---------------------------------------------------------------------

test('getMemories() returns a fresh array each call, safe to mutate', async () => {
  const manager = makeManager()

  await manager.create({
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'Only memory.',
  })

  const firstCall = await manager.getMemories('owner-1')
  assert.equal(firstCall.length, 1)

  // Mutate the returned array in ways that would corrupt shared state
  // if getMemories() exposed internal storage directly.
  firstCall.push({
    id: 'injected',
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'Should not persist.',
    createdAt: 9999,
    updatedAt: 9999,
  })
  firstCall.length = 0

  const secondCall = await manager.getMemories('owner-1')
  assert.equal(secondCall.length, 1)
  assert.equal(secondCall[0]?.content, 'Only memory.')
})

// ---------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------

async function run(): Promise<void> {
  let passed = 0
  let failed = 0

  for (const { name, fn } of tests) {
    try {
      await fn()
      passed++
      console.log(`✅ ${name}`)
    } catch (error) {
      failed++
      console.log(`❌ ${name}`)
      console.log(error instanceof Error ? error.message : String(error))
    }
  }

  const total = passed + failed
  console.log(`🦉 Results: ${passed} passed, ${failed} failed, ${total} total`)

  if (failed > 0) {
    process.exit(1)
  }
}

run()
